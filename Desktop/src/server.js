const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db/local');

const app = express();
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost',
  'app://.',
  'file://',
  'capacitor://',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === 'null' || allowedOrigins.some(a => origin.startsWith(a))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json({ limit: '10mb' }));

const PORT = parseInt(process.env.API_PORT, 10) || 3000;

const pinVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' }
});

const pinCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many PIN creation attempts.' }
});

const globalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts.' }
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

async function resolveTenant(req, res, next) {
  try {
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const db = getDb();
    const tenants = await db.prepare("SELECT tenant_id, pin_hash, company_name FROM tenants").all();
    let match = null;
    for (const row of tenants) {
      if (bcrypt.compareSync(userPin, row.pin_hash)) {
        match = row;
        break;
      }
    }

    if (!match) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    req.tenantId = match.tenant_id;
    req.companyName = match.company_name;
    next();
  } catch (err) {
    console.error('Tenant resolve error:', err.message);
    return res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
}

app.get('/api/health', async (req, res) => {
  try {
    await getDb().prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch {
    res.json({ status: 'error', message: 'Database unreachable' });
  }
});

app.get('/api/pin/status', async (req, res) => {
  try {
    const db = getDb();
    const row = await db.prepare("SELECT COUNT(*) AS count FROM tenants").get();
    const nameRow = await db.prepare("SELECT company_name FROM tenants ORDER BY created_at ASC LIMIT 1").get();
    res.json({
      configured: parseInt(row.count) > 0,
      company_name: nameRow ? nameRow.company_name || '' : ''
    });
  } catch (err) {
    console.error('DB error in /api/pin/status:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/pin/verify', pinVerifyLimiter, async (req, res) => {
  try {
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const db = getDb();
    const tenants = await db.prepare("SELECT tenant_id, pin_hash, company_name FROM tenants").all();
    let match = null;
    for (const row of tenants) {
      if (bcrypt.compareSync(userPin, row.pin_hash)) {
        match = row;
        break;
      }
    }

    if (!match) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const deviceToken = req.headers['x-device-token'];
    let deviceTrusted = false;
    if (deviceToken) {
      const device = await db.prepare("SELECT id FROM trusted_devices WHERE tenant_id = ? AND device_token = ?").get(match.tenant_id, deviceToken);
      deviceTrusted = !!device;
    }

    const tenant = await db.prepare("SELECT totp_enabled FROM tenants WHERE tenant_id = ?").get(match.tenant_id);

    if (tenant && tenant.totp_enabled && !deviceTrusted) {
      return res.json({ valid: true, totpRequired: true, tenant_id: match.tenant_id, company_name: match.company_name });
    }

    return res.json({ valid: true, tenant_id: match.tenant_id, company_name: match.company_name });
  } catch (err) {
    console.error('PIN verify error:', err.message);
    return res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.post('/api/pin', pinCreateLimiter, async (req, res) => {
  try {
    const { pin, company_name } = req.body;

    if (!pin || pin.length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 characters' });
    }
    if (pin.length > 72) {
      return res.status(400).json({ error: 'PIN too long' });
    }

    const db = getDb();
    const existing = await db.prepare("SELECT pin_hash FROM tenants").all();
    for (const row of existing) {
      if (bcrypt.compareSync(pin, row.pin_hash)) {
        return res.status(409).json({ error: 'PIN_ALREADY_EXISTS', message: 'This PIN is already registered.' });
      }
    }

    const compName = (company_name || '').trim();
    if (compName) {
      const dup = await db.prepare("SELECT company_name FROM tenants WHERE company_name = ?").get(compName);
      if (dup) {
        return res.status(409).json({ error: 'COMPANY_EXISTS', message: 'This company name is already registered.' });
      }
    }

    const totpSecret = speakeasy.generateSecret({ length: 20 });
    const hash = bcrypt.hashSync(pin, 6);
    const tenantId = crypto.randomUUID();

    await db.prepare(
      "INSERT INTO tenants (tenant_id, company_name, pin_hash, totp_secret) VALUES (?, ?, ?, ?)"
    ).run(tenantId, compName, hash, totpSecret.base32);

    const qrCodeDataUrl = await QRCode.toDataURL(totpSecret.otpauth_url);

    res.json({
      message: 'PIN set successfully',
      tenant_id: tenantId,
      company_name: compName,
      totpQrCode: qrCodeDataUrl,
      totpEnabled: false
    });
  } catch (err) {
    console.error('PIN set error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: err.message });
  }
});

app.post('/api/auth/totp-verify', async (req, res) => {
  try {
    const userPin = req.headers['x-access-pin'];
    const { code, deviceName } = req.body;

    if (!userPin) {
      return res.status(401).json({ error: 'PIN required' });
    }
    if (!code) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    const db = getDb();
    const tenants = await db.prepare("SELECT tenant_id, pin_hash, totp_secret, totp_enabled, company_name FROM tenants").all();
    let match = null;
    for (const row of tenants) {
      if (bcrypt.compareSync(userPin, row.pin_hash)) {
        match = row;
        break;
      }
    }

    if (!match) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    if (!match.totp_secret) {
      return res.status(400).json({ error: 'TOTP not set up. Please create a PIN first.' });
    }

    const verified = speakeasy.totp.verify({
      secret: match.totp_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    const deviceToken = crypto.randomBytes(32).toString('hex');
    const deviceId = crypto.randomUUID();

    await db.prepare(
      "INSERT INTO trusted_devices (id, tenant_id, device_token, device_name) VALUES (?, ?, ?, ?)"
    ).run(deviceId, match.tenant_id, deviceToken, deviceName || 'Untitled Device');

    if (!match.totp_enabled) {
      await db.prepare("UPDATE tenants SET totp_enabled = 1 WHERE tenant_id = ?").run(match.tenant_id);
    }

    res.json({
      success: true,
      deviceToken,
      tenant_id: match.tenant_id,
      company_name: match.company_name
    });
  } catch (err) {
    console.error('TOTP verify error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: err.message });
  }
});

app.delete('/api/pin', resolveTenant, async (req, res) => {
  try {
    const db = getDb();
    await db.prepare("DELETE FROM stock_entries WHERE tenant_id = ?").run(req.tenantId);
    await db.prepare("DELETE FROM trusted_devices WHERE tenant_id = ?").run(req.tenantId);
    await db.prepare("DELETE FROM tenants WHERE tenant_id = ?").run(req.tenantId);
    res.json({ message: 'PIN and data removed successfully' });
  } catch (err) {
    console.error('PIN delete error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/entries', globalAuthLimiter, resolveTenant, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.prepare(
      `SELECT id, date, type, item, category, quantity, rate, note, created_at AS "createdAt"
       FROM stock_entries
       WHERE tenant_id = ?
       ORDER BY created_at DESC`
    ).all(req.tenantId);
    res.json({ entries: rows });
  } catch (err) {
    console.error('Entries load error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

function validateEntry(entry) {
  if (!entry.id || typeof entry.id !== 'string') return 'Invalid entry ID';
  if (!entry.date || isNaN(Date.parse(entry.date))) return 'Invalid date';
  if (!['in', 'out'].includes(entry.type)) return 'Invalid type';
  if (!entry.item || typeof entry.item !== 'string' || entry.item.length > 255) return 'Invalid item name';
  if (typeof entry.quantity !== 'number' || entry.quantity <= 0) return 'Invalid quantity';
  if (typeof entry.rate !== 'number' || entry.rate < 0) return 'Invalid rate';
  return null;
}

app.post('/api/entries', globalAuthLimiter, resolveTenant, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'entries must be an array' });
  }

  try {
    const db = getDb();

    for (const entry of entries) {
      const err = validateEntry(entry);
      if (err) {
        return res.status(400).json({ error: err });
      }
    }

    const doSave = db.transaction(async (entries) => {
      await db.prepare("DELETE FROM stock_entries WHERE tenant_id = ?").run(req.tenantId);
      for (const entry of entries) {
        await db.prepare(
          `INSERT INTO stock_entries (id, tenant_id, date, type, item, category, quantity, rate, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             date = excluded.date,
             type = excluded.type,
             item = excluded.item,
             category = excluded.category,
             quantity = excluded.quantity,
             rate = excluded.rate,
             note = excluded.note`
        ).run(
          entry.id, req.tenantId, entry.date, entry.type, entry.item, entry.category || '',
          entry.quantity, entry.rate, entry.note || '', entry.createdAt || new Date().toISOString()
        );
      }
    });

    await doSave(entries);
    res.json({ message: 'Entries saved', count: entries.length });
  } catch (err) {
    console.error('Entries save error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/stock', globalAuthLimiter, resolveTenant, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.prepare(
      `SELECT item, category, in_qty, out_qty, balance, latest_rate,
              CASE WHEN latest_rate IS NULL THEN 0 ELSE balance * latest_rate END AS value
       FROM stock_balance
       WHERE tenant_id = ? AND balance > 0
       ORDER BY category, item`
    ).all(req.tenantId);
    res.json(rows);
  } catch (err) {
    console.error('Stock query error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

// ── Licensing System ──
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'zestok-license-secret-change-in-prod';
const JWT_SECRET = process.env.JWT_SECRET || 'zestok-jwt-secret-change-in-prod';

const licenseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many license requests.' }
});

function generateLicenseKey(productType, customerEmail) {
  const data = `${productType}|${customerEmail}|${Date.now()}|${crypto.randomUUID()}`;
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(data).digest('hex').toUpperCase();
  const groups = [];
  for (let i = 0; i < 20; i += 5) {
    groups.push(hmac.slice(i, i + 5));
  }
  return `ZSTK-${groups.join('-')}`;
}

function validateLicenseKeyFormat(key) {
  return /^ZSTK-[A-F0-9]{5}-[A-F0-9]{5}-[A-F0-9]{5}-[A-F0-9]{5}$/.test(key);
}

function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'Admin key required' });
  }
  if (key !== (process.env.ADMIN_KEY || 'zestok-admin-123')) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, expiresIn: '24h' });
});

app.post('/api/payment/submit', async (req, res) => {
  try {
    const { customerName, customerEmail, productType, amount, nayapayTxnId } = req.body;
    if (!customerName || !customerEmail || !productType || !amount || !nayapayTxnId) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const db = getDb();
    const id = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO payments (id, customer_name, customer_email, product_type, amount, nayapay_txn_id, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    ).run(id, customerName, customerEmail, productType, amount, nayapayTxnId);
    res.json({ message: 'Payment submitted. We will verify and send your license within 2-4 hours.', paymentId: id });
  } catch (err) {
    console.error('Payment submit error:', err.message);
    res.status(503).json({ error: 'database_unreachable' });
  }
});

app.get('/api/admin/payments', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const payments = await db.prepare("SELECT * FROM payments ORDER BY created_at DESC").all();
    res.json({ payments });
  } catch (err) {
    res.status(503).json({ error: 'database_unreachable' });
  }
});

app.post('/api/admin/confirm-payment', adminAuth, async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    const db = getDb();
    const payment = await db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ error: 'Payment already processed' });

    const licenseId = crypto.randomUUID();
    const licenseKey = generateLicenseKey(payment.product_type, payment.customer_email);

    let maxActivations = 1;
    if (payment.product_type === 'Bundle') maxActivations = 2;
    else if (payment.product_type === 'Business License') maxActivations = 5;
    else if (payment.product_type === 'Enterprise License') maxActivations = 999;

    await db.prepare(
      "INSERT INTO licenses (id, license_key, product_type, customer_name, customer_email, max_activations, status) VALUES (?, ?, ?, ?, ?, ?, 'active')"
    ).run(licenseId, licenseKey, payment.product_type, payment.customer_name, payment.customer_email, maxActivations);

    await db.prepare("UPDATE payments SET status = 'confirmed' WHERE id = ?").run(paymentId);

    res.json({
      message: 'Payment confirmed and license generated',
      license: { key: licenseKey, productType: payment.product_type, customerEmail: payment.customer_email, maxActivations }
    });
  } catch (err) {
    console.error('Confirm payment error:', err.message);
    res.status(503).json({ error: 'database_unreachable' });
  }
});

app.post('/api/license/activate', licenseLimiter, async (req, res) => {
  try {
    const { licenseKey, deviceFingerprint, deviceName } = req.body;
    if (!licenseKey || !deviceFingerprint) {
      return res.status(400).json({ error: 'licenseKey and deviceFingerprint required' });
    }
    if (!validateLicenseKeyFormat(licenseKey)) {
      return res.status(400).json({ error: 'Invalid license key format' });
    }

    const db = getDb();
    const license = await db.prepare("SELECT * FROM licenses WHERE license_key = ?").get(licenseKey);
    if (!license) return res.status(404).json({ error: 'License key not found' });
    if (license.status !== 'active') return res.status(403).json({ error: 'License is ' + license.status });

    const activations = await db.prepare(
      "SELECT * FROM license_activations WHERE license_id = ? AND deactivated_at IS NULL"
    ).all(license.id);

    if (activations.length >= license.max_activations) {
      return res.status(403).json({ error: 'Device limit reached. Deactivate another device first.' });
    }

    const existing = activations.find(a => a.device_fingerprint === deviceFingerprint);
    if (existing) {
      const token = crypto.randomBytes(32).toString('hex');
      return res.json({ message: 'Device already activated', licenseToken: token, productType: license.product_type });
    }

    const activationId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    await db.prepare(
      "INSERT INTO license_activations (id, license_id, device_fingerprint, device_name) VALUES (?, ?, ?, ?)"
    ).run(activationId, license.id, deviceFingerprint, deviceName || 'Unknown Device');

    res.json({
      message: 'License activated',
      licenseToken: token,
      productType: license.product_type,
      maxActivations: license.max_activations,
      activationsUsed: activations.length + 1
    });
  } catch (err) {
    console.error('License activate error:', err.message);
    res.status(503).json({ error: 'database_unreachable' });
  }
});

app.post('/api/license/validate', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey) return res.status(400).json({ error: 'licenseKey required' });

    const db = getDb();
    const license = await db.prepare("SELECT * FROM licenses WHERE license_key = ?").get(licenseKey);
    if (!license) return res.json({ valid: false, reason: 'not_found' });
    if (license.status !== 'active') return res.json({ valid: false, reason: license.status });

    res.json({ valid: true, productType: license.product_type });
  } catch (err) {
    res.status(503).json({ error: 'database_unreachable' });
  }
});

app.get('/api/license/status', async (req, res) => {
  try {
    const db = getDb();
    const license = await db.prepare("SELECT license_key, product_type, status FROM licenses WHERE status = 'active' LIMIT 1").get();
    if (license) {
      res.json({ licensed: true, productType: license.product_type });
    } else {
      res.json({ licensed: false });
    }
  } catch {
    res.json({ licensed: false });
  }
});

app.post('/api/license/deactivate', async (req, res) => {
  try {
    const { licenseKey, deviceFingerprint } = req.body;
    if (!licenseKey || !deviceFingerprint) {
      return res.status(400).json({ error: 'licenseKey and deviceFingerprint required' });
    }
    const db = getDb();
    const license = await db.prepare("SELECT * FROM licenses WHERE license_key = ?").get(licenseKey);
    if (!license) return res.status(404).json({ error: 'License not found' });

    await db.prepare(
      "UPDATE license_activations SET deactivated_at = datetime('now') WHERE license_id = ? AND device_fingerprint = ? AND deactivated_at IS NULL"
    ).run(license.id, deviceFingerprint);

    res.json({ message: 'Device deactivated' });
  } catch (err) {
    res.status(503).json({ error: 'database_unreachable' });
  }
});

app.get('/api/admin/licenses', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const licenses = await db.prepare("SELECT * FROM licenses ORDER BY created_at DESC").all();
    for (const lic of licenses) {
      const activations = await db.prepare(
        "SELECT COUNT(*) AS count FROM license_activations WHERE license_id = ? AND deactivated_at IS NULL"
      ).get(lic.id);
      lic.activeDevices = parseInt(activations.count);
    }
    res.json({ licenses });
  } catch (err) {
    res.status(503).json({ error: 'database_unreachable' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
});

module.exports = app;
