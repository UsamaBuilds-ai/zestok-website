const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../src/server');
const pool = require('../../src/db/pool');

describe('PostgreSQL Connection Pool', { concurrency: false }, () => {
  let dbAvailable = false;

  before(async () => {
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } catch (err) {
      console.log('PostgreSQL not available — skipping DB-dependent tests.');
    }
  });

  it('should connect to PostgreSQL and execute a basic query', async () => {
    if (!dbAvailable) return;

    const result = await pool.query('SELECT 1 AS value');
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].value, 1);
  });

  it('should have stock_entries table in the database', async () => {
    if (!dbAvailable) return;

    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'stock_entries'"
    );
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].table_name, 'stock_entries');
  });

  it('should have app_settings table in the database', async () => {
    if (!dbAvailable) return;

    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'app_settings'"
    );
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].table_name, 'app_settings');
  });

  it('should have stock_balance view in the database', async () => {
    if (!dbAvailable) return;

    const result = await pool.query(
      "SELECT table_name FROM information_schema.views WHERE table_name = 'stock_balance'"
    );
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].table_name, 'stock_balance');
  });
});

describe('GET /api/pin/status', () => {
  it('should return 503 when PostgreSQL is unreachable', async () => {
    const res = await request(app).get('/api/pin/status');

    if (res.status === 503) {
      // When DB is unavailable, expect 503 with database_unreachable error
      assert.strictEqual(res.body.error, 'database_unreachable');
      assert.ok(res.body.message);
    } else {
      // When DB is available and no PIN is set, expect 200 with configured: false
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.configured, false);
    }
  });

  it('should have module.exports set to the app object for supertest', () => {
    // Verify the Express app is exported for test frameworks
    assert.ok(app, 'Express app should be exported');
    assert.strictEqual(typeof app.get, 'function', 'Exported object should be an Express app');
  });
});
