require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const pool = require('./db/pool');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// PIN verify rate limiter — 5 attempts per 15-minute window (D-08)
const pinVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 5,                   // 5 attempts per window (use 'limit', not deprecated 'max')
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again later.' }
});

// GET /api/pin/status — returns whether a PIN has been configured in app_settings
app.get('/api/pin/status', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'pin'"
    );
    const configured = result.rows.length > 0 && result.rows[0].value.length > 0;
    res.json({ configured });
  } catch (err) {
    console.error('DB error in /api/pin/status:', err.message);
    res.status(503).json({
      error: 'database_unreachable',
      message: 'Database is not available.'
    });
  }
});

// PIN verification middleware — checks x-access-pin header against bcrypt hash in DB
const verifyPin = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'pin'"
    );

    // No PIN configured (D-05, D-07, D-11)
    if (result.rows.length === 0 || !result.rows[0].value) {
      return res.status(200).json({ configured: false, valid: false });
    }

    const userPin = req.headers['x-access-pin'];

    // No PIN header provided (D-10 variant)
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }

    // bcrypt max input guard — reject >72 byte inputs (RESEARCH Pitfall 2)
    if (userPin.length > 72) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    const storedHash = result.rows[0].value;
    const isValid = await bcrypt.compare(userPin, storedHash);

    if (!isValid) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }

    next(); // PIN is valid — proceed to route handler
  } catch (err) {
    console.error('PIN verification error:', err.message);
    return res.status(503).json({
      error: 'database_unreachable',
      message: 'Database is not available.'
    });
  }
};

// GET /api/pin/verify — verify PIN with rate limiting and bcrypt comparison
app.get('/api/pin/verify', pinVerifyLimiter, verifyPin, (req, res) => {
  res.json({ valid: true });
});

// GET /api/stock — returns stock balance grouped by category, filtered to available items
app.get('/api/stock', verifyPin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT item, category, in_qty, out_qty, balance, latest_rate, value
       FROM stock_balance
       WHERE balance > 0
       ORDER BY category, item`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Stock query error:', err.message);
    res.status(503).json({
      error: 'database_unreachable',
      message: 'Database is not available.'
    });
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
