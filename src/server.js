const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
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

function resolveTenant(req, res, next) {
  try {
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const db = getDb();
    const tenants = db.prepare("SELECT tenant_id, pin_hash, company_name FROM tenants").all();
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

app.get('/api/health', (req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch {
    res.json({ status: 'error', message: 'Database unreachable' });
  }
});

app.get('/api/pin/status', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) AS count, (SELECT company_name FROM tenants ORDER BY created_at ASC LIMIT 1) AS company_name FROM tenants").get();
    res.json({
      configured: parseInt(row.count) > 0,
      company_name: row.company_name || ''
    });
  } catch (err) {
    console.error('DB error in /api/pin/status:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/pin/verify', pinVerifyLimiter, (req, res) => {
  try {
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const db = getDb();
    const tenants = db.prepare("SELECT tenant_id, pin_hash, company_name FROM tenants").all();
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
      const device = db.prepare("SELECT id FROM trusted_devices WHERE tenant_id = ? AND device_token = ?").get(match.tenant_id, deviceToken);
      deviceTrusted = !!device;
    }

    const tenant = db.prepare("SELECT totp_enabled FROM tenants WHERE tenant_id = ?").get(match.tenant_id);

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
    const existing = db.prepare("SELECT pin_hash FROM tenants").all();
    for (const row of existing) {
      if (bcrypt.compareSync(pin, row.pin_hash)) {
        return res.status(409).json({ error: 'PIN_ALREADY_EXISTS', message: 'This PIN is already registered.' });
      }
    }

    const compName = (company_name || '').trim();
    if (compName) {
      const dup = db.prepare("SELECT company_name FROM tenants WHERE company_name = ?").get(compName);
      if (dup) {
        return res.status(409).json({ error: 'COMPANY_EXISTS', message: 'This company name is already registered.' });
      }
    }

    const totpSecret = speakeasy.generateSecret({ length: 20 });
    const hash = bcrypt.hashSync(pin, 6);
    const tenantId = crypto.randomUUID();

    const insert = db.prepare(
      "INSERT INTO tenants (tenant_id, company_name, pin_hash, totp_secret) VALUES (?, ?, ?, ?)"
    );
    insert.run(tenantId, compName, hash, totpSecret.base32);

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

app.post('/api/auth/totp-verify', (req, res) => {
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
    const tenants = db.prepare("SELECT tenant_id, pin_hash, totp_secret, totp_enabled, company_name FROM tenants").all();
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

    db.prepare(
      "INSERT INTO trusted_devices (id, tenant_id, device_token, device_name) VALUES (?, ?, ?, ?)"
    ).run(deviceId, match.tenant_id, deviceToken, deviceName || 'Untitled Device');

    if (!match.totp_enabled) {
      db.prepare("UPDATE tenants SET totp_enabled = 1 WHERE tenant_id = ?").run(match.tenant_id);
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

app.delete('/api/pin', resolveTenant, (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM trusted_devices WHERE tenant_id = ?").run(req.tenantId);
    db.prepare("DELETE FROM tenants WHERE tenant_id = ?").run(req.tenantId);
    db.prepare("DELETE FROM stock_entries").run();
    res.json({ message: 'PIN and data removed successfully' });
  } catch (err) {
    console.error('PIN delete error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/entries', globalAuthLimiter, resolveTenant, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, date, type, item, category, quantity, rate, note, created_at AS "createdAt"
       FROM stock_entries
       ORDER BY created_at DESC`
    ).all();
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

app.post('/api/entries', globalAuthLimiter, resolveTenant, (req, res) => {
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

    const del = db.prepare("DELETE FROM stock_entries");
    const insert = db.prepare(
      `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date,
         type = excluded.type,
         item = excluded.item,
         category = excluded.category,
         quantity = excluded.quantity,
         rate = excluded.rate,
         note = excluded.note`
    );

    const doSave = db.transaction((entries) => {
      del.run();
      for (const entry of entries) {
        insert.run(
          entry.id, entry.date, entry.type, entry.item, entry.category || '',
          entry.quantity, entry.rate, entry.note || '', entry.createdAt || new Date().toISOString()
        );
      }
    });

    doSave(entries);
    res.json({ message: 'Entries saved', count: entries.length });
  } catch (err) {
    console.error('Entries save error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/stock', globalAuthLimiter, resolveTenant, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT item, category, in_qty, out_qty, balance, latest_rate,
              CASE WHEN latest_rate IS NULL THEN 0 ELSE balance * latest_rate END AS value
       FROM stock_balance
       WHERE balance > 0
       ORDER BY category, item`
    ).all();
    res.json(rows);
  } catch (err) {
    console.error('Stock query error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
});

module.exports = app;
