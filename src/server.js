require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

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

// (Temporary) GET /api/stock — returns placeholder data until Plan 01-03
app.get('/api/stock', (req, res) => {
  res.json([
    { name: "Item A", qty: 100, amount: 5000 },
    { name: "Item B", qty: 50, amount: 2000 },
  ]);
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
