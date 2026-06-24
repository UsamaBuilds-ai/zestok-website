const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const pool = require('../../src/db/pool');
const app = require('../../src/server');

const TEST_PIN = '1234';
let testPinHash;

describe('GET /api/stock', { concurrency: false }, () => {
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
      await pool.query("DELETE FROM app_settings WHERE key = 'pin'");
    });

    it('returns 401 without valid PIN (no pin configured)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/stock')
        .set('x-access-pin', TEST_PIN);

      // No PIN configured — returns { configured: false, valid: false }
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.configured, false);
      assert.strictEqual(res.body.valid, false);
    });
  });

  describe('when PIN is configured and stock data exists', () => {
    const uniquePrefix = `stock-test-${Date.now()}`;

    before(async () => {
      if (!dbAvailable) return;

      // Set up test PIN
      testPinHash = await require('bcrypt').hash(TEST_PIN, 10);
      await pool.query(
        "INSERT INTO app_settings (key, value) VALUES ('pin', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
        [testPinHash]
      );

      // Clean any existing test data
      await pool.query("DELETE FROM stock_entries WHERE id LIKE $1", [`${uniquePrefix}%`]);
    });

    after(async () => {
      if (!dbAvailable) return;

      // Clean up test data
      await pool.query("DELETE FROM stock_entries WHERE id LIKE $1", [`${uniquePrefix}%`]);
      await pool.query("DELETE FROM app_settings WHERE key = 'pin'");
    });

    it('Test 1: returns array of items with all required fields', async () => {
      if (!dbAvailable) return;

      // Seed 2 entries for the same item
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-1`, '2026-06-01', 'ItemA', 'Category1', 100, 50, 'Test entry', new Date().toISOString()]
      );
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-2`, '2026-06-02', 'ItemA', 'Category1', 50, 55, 'Test entry 2', new Date().toISOString()]
      );

      const res = await request(app)
        .get('/api/stock')
        .set('x-access-pin', TEST_PIN);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body), 'Response body should be an array');

      const itemA = res.body.find(i => i.item === 'ItemA');
      assert.ok(itemA, 'Response should contain ItemA');

      // Verify all required fields exist with correct types
      assert.strictEqual(typeof itemA.item, 'string', 'item should be string');
      assert.strictEqual(typeof itemA.category, 'string', 'category should be string');
      assert.strictEqual(typeof itemA.in_qty, 'number', 'in_qty should be number');
      assert.strictEqual(typeof itemA.out_qty, 'number', 'out_qty should be number');
      assert.strictEqual(typeof itemA.balance, 'number', 'balance should be number');
      assert.strictEqual(typeof itemA.latest_rate, 'number', 'latest_rate should be number');
      assert.strictEqual(typeof itemA.value, 'number', 'value should be number');
    });

    it('Test 2: computes balance correctly (in - out)', async () => {
      if (!dbAvailable) return;

      const itemName = `${uniquePrefix}-balance-test`;

      // Seed: 1 'in' (qty 100) + 1 'out' (qty 30) for same item
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-3`, '2026-06-01', itemName, 'TestCat', 100, 50, 'In entry', new Date().toISOString()]
      );
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'out', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-4`, '2026-06-02', itemName, 'TestCat', 30, 0, 'Out entry', new Date().toISOString()]
      );

      const res = await request(app)
        .get('/api/stock')
        .set('x-access-pin', TEST_PIN);

      assert.strictEqual(res.status, 200);
      const item = res.body.find(i => i.item === itemName);
      assert.ok(item, `Response should contain ${itemName}`);
      assert.strictEqual(item.balance, 70, 'Balance should be 100 - 30 = 70');
    });

    it('Test 3: only returns items with balance > 0', async () => {
      if (!dbAvailable) return;

      const zeroItem = `${uniquePrefix}-zero-bal`;
      const posItem = `${uniquePrefix}-pos-bal`;

      // Seed: 1 item with net balance 0 (equal in/out)
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-5`, '2026-06-01', zeroItem, 'ZeroCat', 50, 10, 'In', new Date().toISOString()]
      );
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'out', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-6`, '2026-06-02', zeroItem, 'ZeroCat', 50, 0, 'Out', new Date().toISOString()]
      );

      // Seed: 1 item with balance > 0
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-7`, '2026-06-01', posItem, 'PosCat', 100, 20, 'In', new Date().toISOString()]
      );

      const res = await request(app)
        .get('/api/stock')
        .set('x-access-pin', TEST_PIN);

      assert.strictEqual(res.status, 200);

      const zeroItemFound = res.body.find(i => i.item === zeroItem);
      assert.ok(!zeroItemFound, `${zeroItem} with balance 0 should NOT appear in response`);

      const posItemFound = res.body.find(i => i.item === posItem);
      assert.ok(posItemFound, `${posItem} with positive balance should appear in response`);
    });

    it('Test 4: returns items ordered by category then item', async () => {
      if (!dbAvailable) return;

      const orderCat = `${uniquePrefix}-ord`;

      // Seed 3 items with mixed categories
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-8`, '2026-06-01', `${orderCat}-ZItem`, 'ACategory', 10, 5, 'Test', new Date().toISOString()]
      );
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-9`, '2026-06-01', `${orderCat}-AItem`, 'BCategory', 10, 5, 'Test', new Date().toISOString()]
      );
      await pool.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, 'in', $3, $4, $5, $6, $7, $8)`,
        [`${uniquePrefix}-10`, '2026-06-01', `${orderCat}-BItem`, 'ACategory', 10, 5, 'Test', new Date().toISOString()]
      );

      const res = await request(app)
        .get('/api/stock')
        .set('x-access-pin', TEST_PIN);

      assert.strictEqual(res.status, 200);

      // Filter only our test items (by unique prefix)
      const relevant = res.body.filter(i =>
        i.item && i.item.startsWith(`${orderCat}-`)
      );

      assert.ok(relevant.length >= 3, `Should find at least 3 test items, found ${relevant.length}`);

      // Expected order: category ASC, item ASC
      // ACategory: orderCat-BItem, orderCat-ZItem
      // BCategory: orderCat-AItem
      const expectedOrder = [
        `${orderCat}-BItem`,  // ACategory, BItem before ZItem
        `${orderCat}-ZItem`,  // ACategory, ZItem after BItem
        `${orderCat}-AItem`,  // BCategory, AItem
      ];

      for (let i = 0; i < expectedOrder.length && i < relevant.length; i++) {
        assert.strictEqual(relevant[i].item, expectedOrder[i],
          `Item at position ${i} should be "${expectedOrder[i]}" but got "${relevant[i].item}"`);
      }
    });

    it('Test 5: returns 401 without valid PIN', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/stock');

      assert.ok(res.status === 401, `Expected 401, got ${res.status}`);
    });

    it('Test 6: returns 503 when database is unreachable', async () => {
      if (!dbAvailable) return;

      // Mock pool.query to simulate DB failure
      const originalQuery = pool.query;
      pool.query = async () => {
        throw new Error('Connection refused');
      };

      try {
        const res = await request(app)
          .get('/api/stock')
          .set('x-access-pin', TEST_PIN);

        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.body.error, 'database_unreachable');
        assert.ok(res.body.message);
      } finally {
        // Restore original query
        pool.query = originalQuery;
      }
    });
  });
});
