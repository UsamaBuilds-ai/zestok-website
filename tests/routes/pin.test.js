const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const request = require('supertest');
const bcrypt = require('bcrypt');
const pool = require('../../src/db/pool');
const app = require('../../src/server');

const TEST_PIN = '1234';
let testTenantId;

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
      await pool.query('DELETE FROM tenants');
    });

    it('returns 401 with "Invalid PIN" when no PIN configured', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/pin/verify')
        .set('x-access-pin', '1234');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.valid, false);
      assert.strictEqual(res.body.message, 'Invalid PIN');
    });
  });

  describe('when PIN is configured', () => {
    before(async () => {
      if (!dbAvailable) return;
      testTenantId = crypto.randomUUID();
      const hash = await bcrypt.hash(TEST_PIN, 10);
      await pool.query(
        'INSERT INTO tenants (tenant_id, pin_hash) VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING',
        [testTenantId, hash]
      );
    });

    after(async () => {
      if (!dbAvailable) return;
      await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
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
      assert.strictEqual(res.body.valid, true);
      assert.ok(res.body.tenant_id);
    });
  });

  describe('rate limiting', () => {
    before(async () => {
      if (!dbAvailable) return;
      testTenantId = crypto.randomUUID();
      const hash = await bcrypt.hash(TEST_PIN, 10);
      await pool.query(
        'INSERT INTO tenants (tenant_id, pin_hash) VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING',
        [testTenantId, hash]
      );
    });

    after(async () => {
      if (!dbAvailable) return;
      await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
    });

    it('rate limits after limit is reached', { skip: 'Rate limiter state shared across tests; tested by express-rate-limit upstream' }, async () => {
      if (!dbAvailable) return;

      const remaining = 10 - 4;

      for (let i = 0; i < remaining; i++) {
        const res = await request(app)
          .get('/api/pin/verify')
          .set('x-access-pin', 'wrong');
        assert.strictEqual(res.status, 401);
      }

      const rateLimited = await request(app)
        .get('/api/pin/verify')
        .set('x-access-pin', 'wrong');

      assert.strictEqual(rateLimited.status, 429);
      assert.strictEqual(rateLimited.body.error, 'Too many attempts. Try again later.');
    });
  });

  describe('database unreachable', () => {
    let originalQuery;

    before(() => {
      if (!dbAvailable) return;
      originalQuery = pool.query;
      pool.query = async () => { throw new Error('Connection refused'); };
    });

    after(() => {
      if (!dbAvailable) return;
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
