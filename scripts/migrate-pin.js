const { Pool } = require('pg');
const crypto = require('crypto');
const pool = new Pool({
  host: 'localhost', port: 5454, database: 'stock_mgmt',
  user: process.env.DB_USER, password: process.env.DB_PASSWORD
});
(async () => {
  const r = await pool.query("SELECT value FROM app_settings WHERE key = 'pin'");
  if (r.rows.length > 0) {
    const hash = r.rows[0].value;
    const tenantId = crypto.randomUUID();

    await pool.query("INSERT INTO tenants (tenant_id, pin_hash) VALUES ($1, $2)", [tenantId, hash]);

    const e = await pool.query("UPDATE stock_entries SET tenant = $1 WHERE tenant = '' OR tenant IS NULL", [tenantId]);
    console.log('Updated entries:', e.rowCount);

    await pool.query("DELETE FROM app_settings WHERE key = 'pin'");
    console.log('Migrated. Tenant ID:', tenantId);
  } else {
    console.log('No old PIN found');
  }
  await pool.end();
})();
