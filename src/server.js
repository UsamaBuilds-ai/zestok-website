const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { Client } = require('pg');
const { masterPool, getTenantPool, ensureMasterDb } = require('./db/pool');

const app = express();
const envOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const apiOrigin = process.env.API_URL ? new URL(process.env.API_URL).origin : null;
const allowedOrigins = [
  'http://localhost:3000',
  'app://.',
  'file://',
  ...envOrigins,
  ...(apiOrigin ? [apiOrigin] : [])
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

function getSuperuserConfig() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5454,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  };
  if (process.env.DB_SSL === 'true') {
    config.ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
  }
  return config;
}

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

async function repairTenantPermissions(dbName) {
  const sup = process.env.DB_SUPER_PASSWORD;
  if (!sup) return;
  let client;
  try {
    client = new Client({ ...getSuperuserConfig(), database: dbName });
    await client.connect();
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ' + quoteIdent(process.env.DB_USER));
    await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ' + quoteIdent(process.env.DB_USER));
    console.log('Repaired permissions on ' + dbName);
  } catch (err) {
    console.error('Permission repair failed for ' + dbName + ':', err.message);
  } finally {
    if (client) try { await client.end(); } catch {}
  }
}

function slugifyDbName(name) {
  let slug = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!slug || slug.length < 1) slug = 'tenant';
  return 'stock_t_' + slug;
}

async function resolveTenantDbName(baseDbName) {
  const existing = await masterPool.query("SELECT db_name FROM tenants");
  const existingNames = new Set(existing.rows.map(r => r.db_name));
  if (!existingNames.has(baseDbName)) return baseDbName;
  let i = 1;
  while (existingNames.has(baseDbName + '_' + i)) i++;
  return baseDbName + '_' + i;
}

const TENANT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS stock_entries (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('in','out')),
    item VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL DEFAULT '',
    quantity DECIMAL(12,2) NOT NULL,
    rate DECIMAL(12,2) NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE OR REPLACE VIEW stock_balance AS
  SELECT
    item,
    category,
    COALESCE(SUM(CASE WHEN type='in' THEN quantity ELSE 0 END), 0) AS in_qty,
    COALESCE(SUM(CASE WHEN type='out' THEN quantity ELSE 0 END), 0) AS out_qty,
    COALESCE(SUM(CASE WHEN type='in' THEN quantity ELSE -quantity END), 0) AS balance,
    (SELECT rate FROM stock_entries e2
     WHERE e2.item = main.item AND e2.type = 'in'
     ORDER BY e2.created_at DESC LIMIT 1) AS latest_rate
  FROM stock_entries main
  GROUP BY item, category;
`;

app.get('/api/health', async (req, res) => {
  try {
    await masterPool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.json({ status: 'error', message: 'Database unreachable' });
  }
});

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

const resolveTenant = async (req, res, next) => {
  try {
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const tenants = await masterPool.query(
      "SELECT tenant_id, db_name, pin_hash, company_name FROM tenants"
    );
    let match = null;
    for (const row of tenants.rows) {
      const isValid = await bcrypt.compare(userPin, row.pin_hash);
      if (isValid) {
        match = row;
        break;
      }
    }

    if (!match) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    req.tenantId = match.tenant_id;
    req.dbName = match.db_name;
    req.companyName = match.company_name;
    req.tenantPool = getTenantPool(match.db_name);
    next();
  } catch (err) {
    console.error('Tenant resolve error:', err.message);
    return res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
};

app.get('/api/pin/status', async (req, res) => {
  try {
    const result = await masterPool.query(
      "SELECT COUNT(*) AS count, (SELECT company_name FROM tenants ORDER BY created_at ASC LIMIT 1) AS company_name FROM tenants"
    );
    res.json({
      configured: parseInt(result.rows[0].count) > 0,
      company_name: result.rows[0].company_name || ''
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

    const tenants = await masterPool.query(
      "SELECT tenant_id, pin_hash, company_name FROM tenants"
    );
    let match = null;
    for (const row of tenants.rows) {
      const isValid = await bcrypt.compare(userPin, row.pin_hash);
      if (isValid) {
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
      const device = await masterPool.query(
        "SELECT id FROM trusted_devices WHERE tenant_id = $1 AND device_token = $2",
        [match.tenant_id, deviceToken]
      );
      deviceTrusted = device.rows.length > 0;
    }

    const totpEnabled = await masterPool.query(
      "SELECT totp_enabled FROM tenants WHERE tenant_id = $1",
      [match.tenant_id]
    );

    if (totpEnabled.rows[0] && totpEnabled.rows[0].totp_enabled && !deviceTrusted) {
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

    const existing = await masterPool.query("SELECT pin_hash FROM tenants");
    for (const row of existing.rows) {
      const match = await bcrypt.compare(pin, row.pin_hash);
      if (match) {
        return res.status(409).json({ error: 'PIN_ALREADY_EXISTS', message: 'This PIN is already registered.' });
      }
    }

    const compName = (company_name || '').trim();

    if (compName) {
      const dup = await masterPool.query(
        "SELECT company_name FROM tenants WHERE company_name = $1",
        [compName]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'COMPANY_EXISTS', message: 'This company name is already registered.' });
      }
    }

    const totpSecret = speakeasy.generateSecret({ length: 20 });
    const baseDbName = slugifyDbName(compName);
    const dbName = await resolveTenantDbName(baseDbName);
    const hash = await bcrypt.hash(pin, 10);
    const tenantId = crypto.randomUUID();

    const sup = process.env.DB_SUPER_PASSWORD;
    if (sup) {
      const suClient = new Client({ ...getSuperuserConfig(), database: 'stock_mgmt' });
      await suClient.connect();
      await suClient.query('CREATE DATABASE ' + quoteIdent(dbName));
      await suClient.query('GRANT ALL PRIVILEGES ON DATABASE ' + quoteIdent(dbName) + ' TO ' + quoteIdent(process.env.DB_USER));
      await suClient.end();
      const suTClient = new Client({ ...getSuperuserConfig(), database: dbName });
      await suTClient.connect();
      await suTClient.query('GRANT ALL PRIVILEGES ON SCHEMA public TO ' + quoteIdent(process.env.DB_USER));
      await suTClient.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ' + quoteIdent(process.env.DB_USER));
      await suTClient.end();
    } else {
      const tmpClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        database: 'stock_mgmt',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });
      await tmpClient.connect();
      await tmpClient.query('CREATE DATABASE ' + quoteIdent(dbName));
      await tmpClient.end();
    }

    const tClient = new Client({ ...getSuperuserConfig(), database: dbName });
    await tClient.connect();
    await tClient.query(TENANT_SCHEMA);
    await tClient.end();

    await masterPool.query(
      "INSERT INTO tenants (tenant_id, db_name, company_name, pin_hash, totp_secret) VALUES ($1, $2, $3, $4, $5)",
      [tenantId, dbName, compName, hash, totpSecret.base32]
    );

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

    const tenants = await masterPool.query(
      "SELECT tenant_id, pin_hash, totp_secret, totp_enabled, company_name FROM tenants"
    );
    let match = null;
    for (const row of tenants.rows) {
      const isValid = await bcrypt.compare(userPin, row.pin_hash);
      if (isValid) {
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

    await masterPool.query(
      "INSERT INTO trusted_devices (id, tenant_id, device_token, device_name) VALUES ($1, $2, $3, $4)",
      [deviceId, match.tenant_id, deviceToken, deviceName || 'Untitled Device']
    );

    if (!match.totp_enabled) {
      await masterPool.query(
        "UPDATE tenants SET totp_enabled = true WHERE tenant_id = $1",
        [match.tenant_id]
      );
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
    const poolToEnd = getTenantPool(req.dbName);
    await poolToEnd.end();

    const tmpClient = new Client(getSuperuserConfig());
    tmpClient.database = 'stock_mgmt';
    await tmpClient.connect();
    await tmpClient.query('DROP DATABASE IF EXISTS ' + quoteIdent(req.dbName));
    await tmpClient.end();

    await masterPool.query("DELETE FROM trusted_devices WHERE tenant_id = $1", [req.tenantId]);
    await masterPool.query("DELETE FROM tenants WHERE tenant_id = $1", [req.tenantId]);

    res.json({ message: 'PIN and data removed successfully' });
  } catch (err) {
    console.error('PIN delete error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/entries', globalAuthLimiter, resolveTenant, async (req, res) => {
  try {
    const result = await req.tenantPool.query(
      `SELECT id, date, type, item, category, quantity, rate, note, created_at AS "createdAt"
       FROM stock_entries
       ORDER BY created_at DESC`
    );
    res.json({ entries: result.rows });
  } catch (err) {
    if (err.message && err.message.includes('permission denied')) {
      await repairTenantPermissions(req.dbName);
      try {
        const result = await req.tenantPool.query(
          `SELECT id, date, type, item, category, quantity, rate, note, created_at AS "createdAt"
           FROM stock_entries
           ORDER BY created_at DESC`
        );
        res.json({ entries: result.rows });
        return;
      } catch {}
    }
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

async function saveEntries(req, res, entries) {
  const client = await req.tenantPool.connect();
  try {
    for (const entry of entries) {
      const err = validateEntry(entry);
      if (err) {
        res.status(400).json({ error: err });
        return false;
      }
    }

    await client.query('BEGIN');

    await client.query("DELETE FROM stock_entries");

    for (const entry of entries) {
      await client.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           date = EXCLUDED.date,
           type = EXCLUDED.type,
           item = EXCLUDED.item,
           category = EXCLUDED.category,
           quantity = EXCLUDED.quantity,
           rate = EXCLUDED.rate,
           note = EXCLUDED.note`,
        [entry.id, entry.date, entry.type, entry.item, entry.category || '',
         entry.quantity, entry.rate, entry.note || '', entry.createdAt || new Date().toISOString()]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Entries saved', count: entries.length });
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

app.post('/api/entries', globalAuthLimiter, resolveTenant, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'entries must be an array' });
  }

  try {
    await saveEntries(req, res, entries);
  } catch (err) {
    if (err.message && err.message.includes('permission denied')) {
      await repairTenantPermissions(req.dbName);
      try {
        await saveEntries(req, res, entries);
        return;
      } catch {}
    }
    console.error('Entries save error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.get('/api/stock', globalAuthLimiter, resolveTenant, async (req, res) => {
  try {
    const result = await req.tenantPool.query(
      `SELECT item, category, in_qty, out_qty, balance, latest_rate,
              CASE WHEN latest_rate IS NULL THEN 0 ELSE balance * latest_rate END AS value
       FROM stock_balance
       WHERE balance > 0
       ORDER BY category, item`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Stock query error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({
      error: 'database_unreachable',
      message: 'Database is not available. Please ensure PostgreSQL is running.'
    });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
});

module.exports = app;
