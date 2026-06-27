require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('./db/pool');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// Simple health check — no DB dependency
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// PIN verify rate limiter
const pinVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' }
});

// Middleware: verify PIN and resolve tenant
const resolveTenant = async (req, res, next) => {
  try {
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const tenants = await pool.query("SELECT tenant_id, pin_hash FROM tenants");
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
    next();
  } catch (err) {
    console.error('Tenant resolve error:', err.message);
    return res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
};

// GET /api/pin/status — check if any PINs are configured
app.get('/api/pin/status', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) AS count FROM tenants");
    res.json({ configured: parseInt(result.rows[0].count) > 0 });
  } catch (err) {
    console.error('DB error in /api/pin/status:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

// GET /api/pin/verify — verify PIN, return tenant_id
app.get('/api/pin/verify', pinVerifyLimiter, async (req, res) => {
  try {
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const tenants = await pool.query("SELECT tenant_id, pin_hash FROM tenants");
    for (const row of tenants.rows) {
      const isValid = await bcrypt.compare(userPin, row.pin_hash);
      if (isValid) {
        return res.json({ valid: true, tenant_id: row.tenant_id });
      }
    }

    return res.status(401).json({ valid: false, message: 'Invalid PIN' });
  } catch (err) {
    console.error('PIN verify error:', err.message);
    return res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

// POST /api/pin — set a new PIN (creates new tenant)
app.post('/api/pin', async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || pin.length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 characters' });
    }

    if (pin.length > 72) {
      return res.status(400).json({ error: 'PIN too long' });
    }

    const hash = await bcrypt.hash(pin, 10);
    const tenantId = crypto.randomUUID();

    await pool.query(
      "INSERT INTO tenants (tenant_id, pin_hash) VALUES ($1, $2)",
      [tenantId, hash]
    );

    res.json({ message: 'PIN set successfully', tenant_id: tenantId });
  } catch (err) {
    console.error('PIN set error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

// DELETE /api/pin — delete a tenant and its data
app.delete('/api/pin', resolveTenant, async (req, res) => {
  try {
    await pool.query("DELETE FROM stock_entries WHERE tenant = $1", [req.tenantId]);
    await pool.query("DELETE FROM tenants WHERE tenant_id = $1", [req.tenantId]);
    res.json({ message: 'PIN and data removed successfully' });
  } catch (err) {
    console.error('PIN delete error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

// GET /api/entries — load entries for the authenticated tenant
app.get('/api/entries', resolveTenant, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, date, type, item, category, quantity, rate, note, created_at AS "createdAt"
       FROM stock_entries
       WHERE tenant = $1
       ORDER BY created_at DESC`,
      [req.tenantId]
    );
    res.json({ entries: result.rows });
  } catch (err) {
    console.error('Entries load error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

// POST /api/entries — save/replace all entries for the authenticated tenant
app.post('/api/entries', resolveTenant, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'entries must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query("DELETE FROM stock_entries WHERE tenant = $1", [req.tenantId]);

    for (const entry of entries) {
      await client.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, tenant, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           date = EXCLUDED.date,
           type = EXCLUDED.type,
           item = EXCLUDED.item,
           category = EXCLUDED.category,
           quantity = EXCLUDED.quantity,
           rate = EXCLUDED.rate,
           note = EXCLUDED.note`,
        [entry.id, entry.date, entry.type, entry.item, entry.category || '',
         entry.quantity, entry.rate, entry.note || '', req.tenantId, entry.createdAt || new Date().toISOString()]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Entries saved', count: entries.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Entries save error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  } finally {
    client.release();
  }
});

// GET /api/stock — returns stock balance for authenticated tenant
app.get('/api/stock', resolveTenant, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT item, category, in_qty, out_qty, balance, latest_rate, value
       FROM stock_balance
       WHERE tenant = $1 AND balance > 0
       ORDER BY category, item`,
      [req.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Stock query error:', err.message);
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available.' });
  }
});

// Global error handler
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stock Management API running on port ${PORT}.`);
});
