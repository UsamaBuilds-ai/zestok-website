const { Pool, Client, types } = require('pg');

types.setTypeParser(1082, (val) => val);

function getBaseConfig() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  if (process.env.DB_SSL === 'true') {
    config.ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.DB_CA_CERT || undefined,
    };
  }
  return config;
}

const baseConfig = getBaseConfig();

const masterPool = new Pool({
  ...baseConfig,
  database: process.env.DB_NAME || 'stock_mgmt',
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

masterPool.on('error', (err) => {
  console.error('Master pool idle error:', err);
});

const tenantPools = {};

function getTenantPool(dbName) {
  if (!tenantPools[dbName]) {
    tenantPools[dbName] = new Pool({
      ...baseConfig,
      database: dbName,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return tenantPools[dbName];
}

const TIMEOUT = 5000;

async function ensureMasterDb() {
  let adminClient;
  const dbName = process.env.DB_NAME || 'stock_mgmt';
  try {
    adminClient = new Client({ ...baseConfig, database: dbName, connectionTimeoutMillis: TIMEOUT });
    await adminClient.connect();
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      adminClient = new Client({ ...baseConfig, database: 'postgres', connectionTimeoutMillis: TIMEOUT });
      await adminClient.connect();
      await adminClient.query('CREATE DATABASE "' + dbName + '"');
      console.log('Created database: ' + dbName);
      await adminClient.end();
      adminClient = new Client({ ...baseConfig, database: dbName, connectionTimeoutMillis: TIMEOUT });
      await adminClient.connect();
    } else {
      throw err;
    }
  }

  await adminClient.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id UUID PRIMARY KEY,
      db_name VARCHAR(255) UNIQUE NOT NULL,
      company_name VARCHAR(255) NOT NULL DEFAULT '',
      pin_hash VARCHAR(255) NOT NULL,
      totp_secret VARCHAR(255) NOT NULL DEFAULT '',
      totp_enabled BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await adminClient.query(`
    CREATE TABLE IF NOT EXISTS trusted_devices (
      id UUID PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
      device_token VARCHAR(255) UNIQUE NOT NULL,
      device_name VARCHAR(255) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await adminClient.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'totp_secret'
      ) THEN
        ALTER TABLE tenants ADD COLUMN totp_secret VARCHAR(255) NOT NULL DEFAULT '';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'totp_enabled'
      ) THEN
        ALTER TABLE tenants ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT false;
      END IF;
    END $$;
  `);

  await adminClient.end();
  console.log('Ensured tenants + trusted_devices tables exist');
}

module.exports = { masterPool, getTenantPool, ensureMasterDb };
