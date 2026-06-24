// src/db/migrate.js
// One-time migration script: reads stock-data.json from the desktop app's userData path
// and inserts all entries into PostgreSQL stock_entries table.
//
// Usage: node src/db/migrate.js
// Or:    npm run migrate
//
// Idempotent — safe to run multiple times. Tracks completion in app_settings.

const fs = require('fs/promises');
const path = require('path');
const pool = require('./pool');

const MIGRATION_KEY = 'data_migration_complete';

async function migrate() {
  // 1. Idempotency check — skip if migration already completed
  const check = await pool.query(
    "SELECT value FROM app_settings WHERE key = $1", [MIGRATION_KEY]
  );
  if (check.rows.length > 0 && check.rows[0].value === 'true') {
    console.log('Migration already completed. Skipping.');
    await pool.end();
    return;
  }

  // 2. Locate the JSON file
  //    Accept USER_DATA_PATH override, fall back to APPDATA + /stock-management/stock-data.json
  const userDataPath = process.env.USER_DATA_PATH || path.join(
    process.env.APPDATA || process.cwd(), 'stock-management', 'stock-data.json'
  );
  console.log('Looking for stock data at:', userDataPath);

  let data;
  try {
    const content = await fs.readFile(userDataPath, 'utf8');
    data = JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('No stock-data.json found. Skipping migration.');
      await pool.end();
      return;
    }
    throw err;
  }

  const entries = data.entries || [];
  if (entries.length === 0) {
    console.log('No entries to migrate.');
    await pool.end();
    return;
  }

  // 3. Insert all entries in a single transaction (DB-05)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const entry of entries) {
      await client.query(
        `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [entry.id, entry.date, entry.type, entry.item, entry.category || '',
         entry.quantity, entry.rate, entry.note || '', entry.createdAt]
      );
    }

    // Mark migration complete in app_settings
    await client.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, 'true')
       ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`,
      [MIGRATION_KEY]
    );

    await client.query('COMMIT');
    console.log(`Migration complete: ${entries.length} entries imported.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
