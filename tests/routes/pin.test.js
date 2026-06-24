const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcrypt');
const pool = require('../../src/db/pool');
const app = require('../../src/server');

const TEST_PIN = '1234';
let testPinHash;

describe('GET /api/pin/verify', { concurrency: false }, () => {
  let dbAvailable = false;

  before(async () => {
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } catch (err) {
      console.log('PostgreSQL not available — skipping DB-dependent tests.');
    }
  });

  describe('when no PIN is configured', () => {
    before(async () => {
      if (!dbAvailable) return;
      // Ensure no PIN is set
      await pool.query("DELETE FROM app_settings WHERE key = 'pin'");
    });

    it('returns { configured: false, valid: false } when no PIN set', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/pin/verify')
        .set('x-access-pin', '1234');

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, { configured: false, valid: false });
    });
  });

  describe('when PIN is configured', () => {
    before(async () => {
      if (!dbAvailable) return;
      testPinHash = await bcrypt.hash(TEST_PIN, 10);
      await pool.query(
        "INSERT INTO app_settings (key, value) VALUES ('pin', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
        [testPinHash]
      );
    });

    after(async () => {
      if (!dbAvailable) return;
      // Clean up test data
      await pool.query("DELETE FROM app_settings WHERE key = 'pin'");
    });

    it('returns 401 with "PIN required" when header is missing', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/pin/verify');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.valid, false);
      assert.strictEqual(res.body.message, 'PIN required');
    });

    it('returns 401 with "Invalid PIN" when PIN is wrong', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/pin/verify')
        .set('x-access-pin', 'wrong');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.valid, false);
      assert.strictEqual(res.body.message, 'Invalid PIN');
    });

    it('returns { valid: true } when PIN is correct', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/pin/verify')
        .set('x-access-pin', TEST_PIN);

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, { valid: true });
    });
  });

  describe('rate limiting', () => {
    before(async () => {
      if (!dbAvailable) return;
      testPinHash = await bcrypt.hash(TEST_PIN, 10);
      await pool.query(
        "INSERT INTO app_settings (key, value) VALUES ('pin', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
        [testPinHash]
      );
    });

    after(async () => {
      if (!dbAvailable) return;
      await pool.query("DELETE FROM app_settings WHERE key = 'pin'");
    });

    it('returns 429 after 5 rapid wrong attempts', async () => {
      if (!dbAvailable) return;

      // Send 5 rapid requests with wrong PIN — expect 401 each
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .get('/api/pin/verify')
          .set('x-access-pin', 'wrong');
        assert.strictEqual(res.status, 401);
      }

      // 6th request — expect 429 rate limited
      const rateLimited = await request(app)
        .get('/api/pin/verify')
        .set('x-access-pin', 'wrong');

      assert.strictEqual(rateLimited.status, 429);
      assert.strictEqual(rateLimited.body.error, 'Too many PIN attempts. Try again later.');
    });
  });

  describe('database unreachable', () => {
    let originalQuery;

    before(() => {
      if (!dbAvailable) return;
      // Mock pool.query to simulate DB failure
      originalQuery = pool.query;
      pool.query = async () => {
        throw new Error('Connection refused');
      };
    });

    after(() => {
      if (!dbAvailable) return;
      // Restore original query
      pool.query = originalQuery;
    });

    it('returns 503 when database is unreachable', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/pin/verify')
        .set('x-access-pin', '1234');

      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.error, 'database_unreachable');
      assert.ok(res.body.message);
    });
  });
});
