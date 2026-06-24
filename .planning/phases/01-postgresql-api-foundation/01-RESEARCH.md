# Phase 1: PostgreSQL + API Foundation - Research

**Researched:** 2026-06-24
**Domain:** PostgreSQL 16+ on Windows, Express API database integration, bcrypt authentication, rate limiting
**Confidence:** HIGH

## Summary

This phase migrates the Stock Management Express API from mock data and hardcoded PIN to a PostgreSQL-backed production-ready API. The existing codebase uses Express v5.2.1 with CORS on port 3000, a hardcoded PIN "1234", and mock static data. The research established a clear standard stack: `pg` (v8.22.0) for PostgreSQL connectivity with connection pooling, `bcrypt` (v6.0.0) for PIN hashing, `express-rate-limit` (v8.5.2) for brute-force protection on the verify endpoint, and `dotenv` (v17.4.2) for .env-based configuration.

PostgreSQL 16+ will be installed manually via the official EDB Windows installer from postgresql.org. The database `stock_db` will contain `stock_entries` and `app_settings` tables plus a `stock_balance` SQL view. A one-time Node.js migration script reads the existing `stock-data.json` and inserts into PostgreSQL. The Express server gains a connection pool module, new endpoints (`GET /api/pin/status`, updated `GET /api/pin/verify`), and the existing `GET /api/stock` is rewritten to query the balance view.

**Primary recommendation:** Use `pg` Pool singleton for all database access, `bcrypt.compare()` with 10 salt rounds for PIN verification, `express-rate-limit` with a 5-attempt/15-minute window on the verify endpoint, and `dotenv` loaded at server startup for configuration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Database connection management | API / Backend | — | Connection pool lives in Express process (the only DB client in Phase 1) |
| Schema creation & migration | API / Backend | — | Migration script runs once; DDL applied at known point, no ORM layer |
| Stock data querying | API / Backend | Database / Storage | Express queries PostgreSQL via `pg` pool; SQL view computes balances server-side |
| PIN verification | API / Backend | — | Express middleware checks `bcrypt.compare()` against stored hash in DB |
| Rate limiting | API / Backend | — | Middleware applied to Express route; client IP is the key |
| PIN storage | Database / Storage | — | bcrypt hash stored in `app_settings` table; plaintext never persisted |
| JSON data migration | API / Backend | — | One-time Node.js script reads JSON file, inserts into PostgreSQL |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** PostgreSQL connection details stored in `.env` file loaded via dotenv — host, port, database name, user, password
- **D-02:** PostgreSQL installed manually via official Windows installer (postgresql.org) — detailed step-by-step setup instructions included in plan
- **D-03:** Database name: `stock_db`
- **D-04:** PostgreSQL port: 5432 (default)
- **D-05:** `GET /api/pin/status` returns `{ configured: false }` when no PIN has been set — API rejects mobile requests until desktop configures PIN in Phase 2
- **D-06:** PIN stored as bcrypt hash in `app_settings` table — plain text never persisted
- **D-07:** No default PIN — desktop Phase 2 provides the PIN settings page. Phase 1 API returns "not configured" state
- **D-08:** Rate limiting added to PIN verify endpoint in Phase 1 via `express-rate-limit` — prevents brute force from day one
- **D-09:** PostgreSQL unreachable → HTTP 503 with `{ error: 'database_unreachable', message: '...' }`
- **D-10:** Wrong PIN → HTTP 401 with `{ valid: false, message: 'Invalid PIN' }`
- **D-11:** PIN not configured → HTTP 200 with `{ configured: false, valid: false }`
- **D-12:** Schema validation errors → HTTP 400 with specific error details in response body

### The Agent's Discretion

None specified in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DB-01 | PostgreSQL 16+ installed and configured on Windows | Windows installer available at postgresql.org/download/windows/ via EDB; also available via `winget install PostgreSQL.PostgreSQL.16`; user opts for manual installer |
| DB-02 | Database schema with `stock_entries` table matching entry model | Schema maps directly from existing entry data model: id (UUID PK), date, type (CHECK in/out), item, category, quantity (numeric), rate (numeric), note, created_at — with proper indexes on item, category, date |
| DB-03 | Database schema with `app_settings` table (PIN, config) | Simple key-value pair table: key (TEXT PK), value (TEXT), created_at, updated_at. PIN stored as bcrypt hash with key='pin' |
| DB-04 | Stock balance view (computed from entries) | SQL view using SUM with CASE expressions: `SUM(CASE WHEN type='in' THEN quantity ELSE 0 END) - SUM(CASE WHEN type='out' THEN quantity ELSE 0 END)` grouped by item, category — mirrors `getBalances()` in renderer.js:22-51 |
| DB-05 | JSON file data migrated to PostgreSQL | One-time Node.js migration script that reads `stock-data.json` from userData path, inserts all entries into `stock_entries` table, tracks migration status in `app_settings` |
| API-01 | Express connects to PostgreSQL with connection pool | `pg` Pool class configured from .env variables; singleton module at `src/db/pool.js`; pool.on('error') handler for logging; pool.query() for single queries |
| API-02 | `GET /api/stock` returns stock balance grouped by category | Query the `stock_balance` view, ORDER BY category, item; response includes item, category, inQty, outQty, balance, latestRate, value |
| API-03 | `GET /api/stock` returns only available items (balance > 0) | Add `WHERE balance > 0` condition in query or filter on the view |
| API-04 | `GET /api/pin/verify` verifies PIN from request header | Read PIN hash from app_settings key='pin'; use bcrypt.compare() with `x-access-pin` header; return 401 on mismatch, 200 with `{ valid: true }` on match, 200 with `{ configured: false }` if no PIN set |
| API-05 | `GET /api/pin/status` returns whether PIN is configured | Check if app_settings has key='pin' with non-empty value; return `{ configured: true/false }` |
| API-06 | API returns category information with each item | `stock_balance` view includes category column from entries; response objects include category |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg | 8.22.0 | PostgreSQL client with connection pool | Established, maintained (14+ yrs, 50M+ weekly downloads), built-in pool, documented patterns, Express-compatible [VERIFIED: npm registry] |
| bcrypt | 6.0.0 | PIN hashing and verification | Industry standard for password hashing, 10+ yrs, actively maintained, Node.js native binding for speed [VERIFIED: npm registry] |
| express-rate-limit | 8.5.2 | Rate limiting middleware | Standard Express middleware for brute-force protection, supports Express 5 peer dependency (v8.5.2 explicitly allows Express 5), 3.2k stars [VERIFIED: npm registry] |
| dotenv | 17.4.2 | .env file configuration loader | Zero-dependency, 12-factor app standard, most popular Node.js config loader [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cors | ^2.8.6 | CORS middleware | Already installed, keep as-is for mobile client access |
| express | ^5.2.1 | Web framework | Already installed, no upgrade needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg | pg-promise | pg-promise adds promise chaining sugar but pg v8+ already has full promise support; pg is simpler, more widely used, fewer dependencies |
| bcrypt | bcryptjs | bcryptjs is pure JS (slower, no native compilation), bcrypt is 100% compatible API but faster via native binding |
| express-rate-limit | rate-limiter-flexible | express-rate-limit is simpler, purpose-built for Express middleware; rate-limiter-flexible more configurable but overkill for single-endpoint rate limiting |

**Installation:**
```bash
npm install pg bcrypt express-rate-limit dotenv
```

**Version verification:** Verified via `npm view` on 2026-06-24. All packages are current stable releases, compatible with Node.js v24.16.0 and Express v5.2.1.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pg | npm | 14+ yrs | 50M+/week | github.com/brianc/node-postgres | OK | Approved |
| bcrypt | npm | 13+ yrs | 10M+/week | github.com/kelektiv/node.bcrypt.js | OK | Approved |
| express-rate-limit | npm | 10+ yrs | 5M+/week | github.com/express-rate-limit/express-rate-limit | OK | Approved |
| dotenv | npm | 11+ yrs | 50M+/week | github.com/motdotla/dotenv | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*All packages were verified against the npm registry and have established source repositories, high download counts, and long publication histories.*

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                    Electron Application                            │
│                                                                   │
│  ┌─────────────────────────────┐      IPC                         │
│  │     Main Process            │◄────────────────────┐            │
│  │     (src/main.js)           │                      │            │
│  │                             │  stock:load          │            │
│  │  - Window management        │  stock:save          │            │
│  │  - File I/O (removed)       │  stock:export-report │            │
│  │  - PDF export               │                      │            │
│  │                             │  ┌─────────────────┐ │            │
│  │  Express Server v5          │  │  Renderer (Web) │ │            │
│  │  (src/server.js)            │  │  (vanilla JS)   │ │            │
│  │  Port 3000                  │  │                 │ │            │
│  │                             │  │  - Dashboard    │ │            │
│  │  ┌─────────────────────────┐│  │  - Entry form   │ │            │
│  │  │  Pool (pg)              ││  │  - Reports      │ │            │
│  │  │  src/db/pool.js         ││  │  - Export       │ │            │
│  │  └───────────┬─────────────┘│  └─────────────────┘ │            │
│  └──────────────┼──────────────┘                      │            │
│                 │                                     │            │
└─────────────────┼─────────────────────────────────────┘            │
                  │                                                    │
                  │ TCP/5432                                           │
                  ▼                                                    │
┌──────────────────────────────────┐                                  │
│       PostgreSQL 16+             │                                  │
│       stock_db                    │                                  │
│                                  │                                  │
│  ┌─────────────────┐            │    Mobile Client (Phase 3)        │
│  │  stock_entries   │            │        │                          │
│  │  stock_balance   │◄─── view   │        │ HTTP/JSON               │
│  │  (computed view) │            │        │ (x-access-pin header)   │
│  │  app_settings    │            │        ▼                          │
│  └─────────────────┘            │  ┌──────────────┐                 │
└──────────────────────────────────┘  │ Android APK  │                 │
                                       │ (Phase 3)   │                 │
                                       └──────────────┘                 │
```

**Data Flow:**
```
GET /api/stock (with PIN header)
  → express-rate-limit check (verify endpoint only)
  → PIN verify middleware: bcrypt.compare(header, hash from app_settings)
  → Query: SELECT * FROM stock_balance WHERE balance > 0 ORDER BY category, item
  → JSON response

GET /api/pin/verify (with PIN header)
  → express-rate-limit check
  → Read pin hash from app_settings
  → If no pin: { configured: false, valid: false }
  → If pin: bcrypt.compare() → { valid: true/false }

GET /api/pin/status
  → Check if app_settings key='pin' exists and is non-empty
  → { configured: true/false }
```

### Recommended Project Structure
```
src/
├── server.js            # Express server (modified: add pool, new routes)
├── main.js              # Electron main (unchanged in Phase 1)
├── renderer.js          # UI logic (unchanged in Phase 1)
├── preload.js           # IPC bridge (unchanged in Phase 1)
├── db/
│   ├── pool.js          # pg Pool singleton (NEW)
│   ├── schema.sql       # DDL for tables + view (NEW)
│   └── migrate.js       # One-time JSON→PostgreSQL migration (NEW)
└── .env                 # Environment config (NEW, .gitignored)
```

### Pattern 1: Connection Pool Singleton
**What:** A single exported `Pool` instance created from environment variables, imported by any module that needs database access.
**When to use:** Every database operation in this phase — single queries use `pool.query()`, transactions use `pool.connect()` + `client.query()` + `client.release()`.

**Example:**
```javascript
// src/db/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'stock_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 10,                     // default pool size
  idleTimeoutMillis: 30000,    // close idle clients after 30s
  connectionTimeoutMillis: 2000, // fail fast if DB unreachable
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

module.exports = pool;
```
[CITED: node-postgres.com/features/pooling]

### Pattern 2: PIN Verification Middleware
**What:** Express middleware that checks the `x-access-pin` header against the stored bcrypt hash in `app_settings`.
**When to use:** Protect `/api/stock` and `/api/pin/verify` routes.

**Example:**
```javascript
// Inside server.js or a middleware module
const bcrypt = require('bcrypt');
const pool = require('./db/pool');

const verifyPin = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'pin'"
    );
    
    if (result.rows.length === 0) {
      // No PIN configured
      return res.status(200).json({ configured: false, valid: false });
    }
    
    const userPin = req.headers['x-access-pin'];
    if (!userPin) {
      return res.status(401).json({ valid: false, message: 'PIN required' });
    }
    
    const valid = await bcrypt.compare(userPin, result.rows[0].value);
    if (!valid) {
      return res.status(401).json({ valid: false, message: 'Invalid PIN' });
    }
    
    next();
  } catch (err) {
    next(err);
  }
};
```
[CITED: github.com/kelektiv/node.bcrypt.js — bcrypt.compare() pattern]

### Anti-Patterns to Avoid
- **Directly using `pg` Client instead of Pool:** Always use Pool for web applications. A single Client connection is not suitable for concurrent requests — it serializes all queries. Pool handles concurrent clients automatically.
- **Storing plaintext PIN:** Never log, store, or return the PIN in plaintext. Use bcrypt.hash() before storing and bcrypt.compare() for verification. The bcrypt hash includes the salt, so no separate salt column is needed.
- **Rate limiting the wrong endpoint:** Only rate-limit the PIN verify endpoint, not the stock endpoint. Stock queries are read-only and low-cost; rate limiting them would degrade mobile UX without security benefit.
- **Exposing database errors to client:** Catch pool.query errors and return `{ error: 'database_unreachable', message: '...' }` (HTTP 503) instead of leaking PostgreSQL error details.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database connection pooling | Manual connection management | `pg` Pool | Handles lazy creation, queueing, lifecycle, error recovery — 14+ years of battle testing |
| PIN hashing | Custom hash function | `bcrypt` | Built-in salt generation, cost factor tuning, timing-attack-resistant comparison |
| Rate limiting | Request counter with timers | `express-rate-limit` | IP-based tracking, window management, standard headers, Express middleware integration |
| Environment config | Config file parser | `dotenv` | 12-factor standard, zero dependencies, process.env integration, multi-file support |

**Key insight:** All four "don't hand-roll" items are well-established, single-responsibility libraries that handle subtle edge cases (connection leaks, timing attacks, race conditions, encoding issues) that custom implementations get wrong.

## Common Pitfalls

### Pitfall 1: Pool Client Leak
**What goes wrong:** Forgetting to call `client.release()` after `pool.connect()` drains the pool, eventually freezing all database operations.
**Why it happens:** When using `pool.connect()` for transactions, developers forget the `release()` call in error paths.
**How to avoid:** Prefer `pool.query()` for single queries (auto-release). For transactions, use `pool.connect()` with try/finally:
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... queries ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```
**Warning signs:** Application freezes on DB operations; error logs show "remaining connection slots are reserved"
[CITED: node-postgres.com/apis/pool — "you must always return the client to the pool"]

### Pitfall 2: bcrypt max input length
**What goes wrong:** bcrypt silently truncates passwords longer than 72 bytes. Passwords over 72 characters will match any password with the same first 72 characters.
**Why it happens:** bcrypt algorithm has a 72-byte input limit; the Node.js library does not warn or check.
**How to avoid:** Add an explicit check before hashing/comparing:
```javascript
if (pin.length > 72) { /* reject or pre-hash */ }
```
For PIN codes (typically 4-6 digits), this is not a practical concern, but the checker should know.
**Warning signs:** PINs with identical first 72 characters authenticate as the same PIN.
[CITED: npmjs.com/package/bcryptjs — "The maximum input length is 72 bytes"]

### Pitfall 3: Express 5 route parameter changes
**What goes wrong:** Express v5 changed route parameter matching. `app.get('/api/stock')` works the same, but error handling middleware signatures changed (synchronous errors now handled by default).
**Why it happens:** Express v5 has breaking changes from v4. The project uses Express v5.2.1.
**How to avoid:** Use `async` route handlers with try/catch, or wrap async handlers. Express v5 catches promise rejections automatically for async route handlers, making error handling simpler:
```javascript
app.get('/api/stock', verifyPin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stock_balance WHERE balance > 0');
    res.json(result.rows);
  } catch (err) {
    res.status(503).json({ error: 'database_unreachable', message: 'Database is not available' });
  }
});
```
**Warning signs:** Unhandled promise rejections in async route handlers.
[CITED: expressjs.com — Express 5 migration guide]

### Pitfall 4: express-rate-limit option naming in v8
**What goes wrong:** Using the old `max` option name instead of `limit` — the `max` option still works with a deprecation warning in v8.
**Why it happens:** express-rate-limit renamed `max` to `limit` in v7. Users familiar with older versions use `max`.
**How to avoid:** Use `limit: 5` (not `max: 5`) in new code.
**Warning signs:** Deprecation warning in console on startup.
[CITED: express-rate-limit.mintlify.app — "limit" option configuration page]

## Code Examples

### DB Connection Pool Setup
```javascript
// src/db/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'stock_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

module.exports = pool;
```
[VERIFIED: node-postgres.com/apis/pool — Pool constructor docs]

### Database Schema (DDL)
```sql
-- stock_entries table
CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID PRIMARY KEY,
  date DATE NOT NULL,
  type VARCHAR(3) NOT NULL CHECK (type IN ('in', 'out')),
  item VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL DEFAULT '',
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stock_entries_item ON stock_entries(item);
CREATE INDEX IF NOT EXISTS idx_stock_entries_category ON stock_entries(category);
CREATE INDEX IF NOT EXISTS idx_stock_entries_date ON stock_entries(date);
CREATE INDEX IF NOT EXISTS idx_stock_entries_type ON stock_entries(type);

-- app_settings table (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- stock_balance view
CREATE OR REPLACE VIEW stock_balance AS
SELECT
  item,
  category,
  SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) AS in_qty,
  SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) AS out_qty,
  SUM(CASE WHEN type = 'in' THEN quantity ELSE -quantity END) AS balance,
  MAX(CASE WHEN type = 'in' THEN rate ELSE 0 END) FILTER (WHERE type = 'in') AS latest_rate,
  SUM(CASE WHEN type = 'in' THEN quantity ELSE -quantity END) *
    MAX(CASE WHEN type = 'in' THEN rate ELSE 0 END) FILTER (WHERE type = 'in') AS value
FROM stock_entries
GROUP BY item, category;
```
[CITED: PostgreSQL documentation for CREATE VIEW, CHECK constraints]

### Rate Limiting PIN Verify
```javascript
const rateLimit = require('express-rate-limit');

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 5,                   // 5 attempts per window
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Try again later.' },
});

// Apply to verify endpoint
app.get('/api/pin/verify', pinLimiter, verifyPinLogic);
```
[CITED: express-rate-limit.mintlify.app/reference/configuration — windowMs, limit, headers]

### PIN Verification with bcrypt
```javascript
const bcrypt = require('bcrypt');
const pool = require('./db/pool');

// Verify PIN
const userPin = req.headers['x-access-pin'];
const result = await pool.query("SELECT value FROM app_settings WHERE key = 'pin'");

if (result.rows.length === 0) {
  return res.status(200).json({ configured: false, valid: false });
}

const storedHash = result.rows[0].value;
const isValid = await bcrypt.compare(userPin, storedHash);

if (isValid) {
  return res.json({ valid: true });
} else {
  return res.status(401).json({ valid: false, message: 'Invalid PIN' });
}
```
[CITED: github.com/kelektiv/node.bcrypt.js — bcrypt.compare() pattern]

### JSON Data Migration Script
```javascript
// src/db/migrate.js
// Run once: node src/db/migrate.js

const fs = require('fs/promises');
const path = require('path');
const pool = require('./pool');

const MIGRATION_KEY = 'data_migration_complete';

async function migrate() {
  // Check if migration already ran
  const check = await pool.query(
    "SELECT value FROM app_settings WHERE key = $1", [MIGRATION_KEY]
  );
  if (check.rows.length > 0 && check.rows[0].value === 'true') {
    console.log('Migration already completed. Skipping.');
    await pool.end();
    return;
  }

  // Read JSON file
  const userDataPath = process.env.USER_DATA_PATH || path.join(
    process.env.APPDATA || process.cwd(), 'stock-management', 'stock-data.json'
  );
  
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

  // Insert all entries in a transaction
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
    
    // Mark migration as complete
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
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON file storage (`stock-data.json`) | PostgreSQL with connection pool | Phase 1 | Adds ACID transactions, concurrent access, query capability |
| Hardcoded PIN `"1234"` | bcrypt-hashed PIN in database | Phase 1 | Eliminates hardcoded auth, enables user-configurable PIN |
| Mock data (`getStockData()`) | Real queries via `stock_balance` view | Phase 1 | Mobile API returns real stock data, not placeholder |
| No rate limiting | express-rate-limit on verify endpoint | Phase 1 | Prevents brute-force attacks on PIN from day one |
| Flat file persistence in main process | DB-aware Express server | Phase 1 | Desktop (Phase 2) will also migrate to DB; Phase 1 leaves desktop on JSON temporarily |

**Deprecated/outdated:**
- Hardcoded PIN auth (`SECRET_PIN = "1234"`): Must be removed in Phase 1. Mobile PIN verification switches to bcrypt+DB.
- Mock data getter (`getStockData()`): Replaced with real SQL query against `stock_balance` view.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `stock-data.json` exists at `app.getPath("userData")/stock-data.json` with the same entry shape as the existing code | Standard Stack | Migration script would find no data or wrong schema — handle gracefully with ENOENT check and skip migration |
| A2 | PIN length will not exceed 72 bytes (bcrypt limit) | Common Pitfalls | PINs are typically 4-6 digits; 72-byte limit is irrelevant for PIN codes |
| A3 | `app_settings` table with key='pin' is sufficient — no multi-user or multiple PINs needed | Architecture | Locked decision: single PIN shared among mobile users. If this changes, schema needs user_id column |
| A4 | `express-rate-limit@8.5.2` with Express v5.2.1 works correctly | Standard Stack | Confirmed via npm registry: peer dependency `express >= 4.11` includes v5. v8.5.2 changelog explicitly loosened peer deps for Express 5. Verified via tests in the rate-limit repo using Express 5. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

*One assumption exists (A1 about JSON file location). The migration script should handle gracefully.*

## Open Questions

1. **JSON file location for migration**
   - What we know: Electron `app.getPath("userData")` resolves to something like `C:\Users\<user>\AppData\Roaming\stock-management\stock-data.json`. The migration script needs this path but runs standalone (not within Electron).
   - What's unclear: Exact path resolution for the standalone migration script.
   - Recommendation: Accept `USER_DATA_PATH` environment variable, fall back to `process.env.APPDATA + '/stock-management/stock-data.json'`, and log the path for troubleshooting.

2. **Migration idempotency**
   - What we know: The migration script should use `ON CONFLICT (id) DO NOTHING` for entries and track completion in `app_settings`.
   - What's unclear: Whether the JSON file will be present and non-empty on every target machine.
   - Recommendation: Make migration gracefully handle missing/empty JSON files.

3. **`.env` file location when Electron starts**
   - What we know: `.env` is at project root. `require('dotenv').config()` reads from `process.cwd()`.
   - What's unclear: When the packaged Electron app runs, `process.cwd()` may differ from the project root.
   - Recommendation: Use `path.resolve(__dirname, '../.env')` or document that the `.env` must be alongside the executable in production builds. Phase 1 leaves desktop on JSON, so this is only relevant for the Express server which runs from the project directory during development.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Express server, migration script | ✓ | v24.16.0 | — |
| npm | Package installation | ✓ | 11.17.0 | — |
| PostgreSQL 16+ | Database | ✗ (to be installed) | — | Must be installed via manual installer |
| psql | DB verification | ✗ (to be installed) | — | Part of PostgreSQL installation |

**Missing dependencies with no fallback:**
- PostgreSQL 16+ must be installed via the official Windows installer (EDB). The plan MUST include detailed step-by-step instructions covering: downloading from postgresql.org, running the EDB installer, setting the postgres superuser password, creating the `stock_db` database via psql or pgAdmin, and verifying connectivity.

**Missing dependencies with fallback:**
- None — all other dependencies are npm packages that will be installed.

## Validation Architecture

> Included because `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently — Wave 0 must choose and install |
| Config file | none — determined in Wave 0 |
| Quick run command | TBD by Wave 0 |
| Full suite command | TBD by Wave 0 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | PostgreSQL installed and configured | Manual | — | ❌ Wave 0 — setup instructions only (cannot automate) |
| DB-02 | Schema with stock_entries table | Integration | TBD | ❌ Wave 0 |
| DB-03 | Schema with app_settings table | Integration | TBD | ❌ Wave 0 |
| DB-04 | stock_balance view exists | Integration | TBD | ❌ Wave 0 |
| DB-05 | Migration script imports JSON data | Integration | TBD | ❌ Wave 0 |
| API-01 | Express connects to PostgreSQL with pool | Integration | TBD | ❌ Wave 0 |
| API-02 | GET /api/stock returns grouped balance | Integration | TBD | ❌ Wave 0 |
| API-03 | GET /api/stock filters to balance > 0 | Integration | TBD | ❌ Wave 0 |
| API-04 | PIN verification with bcrypt | Integration | TBD | ❌ Wave 0 |
| API-05 | PIN status endpoint works | Integration | TBD | ❌ Wave 0 |
| API-06 | Response includes category per item | Integration | TBD | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** TBD after Wave 0 test framework selection
- **Per wave merge:** Integration tests pass against a real or in-memory PostgreSQL
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/` directory does not exist — must be created
- [ ] Test framework undetermined — recommend `jest` with `supertest` for API integration tests, or plain `node:test` (built-in Node.js 20+) to minimize dependencies
- [ ] `tests/conftest.js` or `tests/setup.js` — shared setup for pool creation and test data seeding
- [ ] `tests/db/pool.test.js` — connection pool initialization
- [ ] `tests/db/schema.test.js` — schema application and verification
- [ ] `tests/routes/stock.test.js` — GET /api/stock endpoint tests via supertest
- [ ] `tests/routes/pin.test.js` — PIN verify/status endpoint tests
- [ ] `tests/migration/migrate.test.js` — migration script against test data

**Testing recommendation:** Use `node:test` (built-in, no install) + `supertest` (HTTP assertion, 1 dependency) for a lightweight test setup. This avoids adding jest (30+ dependencies) for a project that doesn't currently have any test infrastructure.

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled). The config.json does not set it to false.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | bcrypt.compare() for PIN verification; `x-access-pin` request header |
| V3 Session Management | no | Stateless PIN-per-request; no session/cookies needed for Phase 1 |
| V4 Access Control | partial | PIN middleware on protected routes; no role-based access |
| V5 Input Validation | yes | zod or manual validation on request body/headers; HTTP 400 for invalid input |
| V6 Cryptography | yes | bcrypt (not hand-rolled) for PIN hashing; algorithm includes salt generation |

### Known Threat Patterns for Express + PostgreSQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Parameterized queries (`$1`, `$2`) via `pg` — never string-interpolate user input into SQL |
| Brute force PIN | Denial of Service | `express-rate-limit`: 5 attempts per 15-minute window per IP |
| Plaintext credential leak | Information Disclosure | bcrypt hashing before storage; PIN never logged or returned in responses |
| Database connection exhaustion | Denial of Service | Pool.max=10 limits concurrent connections; connectionTimeoutMillis=2000 fails fast |
| Timing attack on PIN comparison | Information Disclosure | bcrypt.compare() compares full hashes (not passwords), bcrypt digests are preimage-resistant — timing safe by design |

## Sources

### Primary (HIGH confidence)
- **node-postgres official docs** (`node-postgres.com/apis/pool`, `node-postgres.com/features/pooling`) — Connection pool patterns, Pool API, query methods [VERIFIED: official docs]
- **bcrypt.js GitHub README** (`github.com/kelektiv/node.bcrypt.js`) — hash/compare API, salt rounds, async usage [VERIFIED: official repo]
- **express-rate-limit official docs** (`express-rate-limit.mintlify.app`) — Configuration API, Express 5 compatibility [VERIFIED: official docs]
- **dotenv GitHub** (`github.com/motdotla/dotenv`) — .env file loading, config() API [VERIFIED: official repo]
- **npm registry** (`npm view pg`, `npm view bcrypt`, etc.) — Package versions, publish dates, engines requirements [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- **PostgreSQL Windows installers** (`postgresql.org/download/windows/`) — EDB installer for PostgreSQL 16+ on Windows [CITED: official PostgreSQL download page]
- **EDB Windows installation guide** (`enterprisedb.com/docs`) — winget install option, unattended installation steps [CITED: EDB docs]

### Tertiary (LOW confidence)
- Stack Overflow bcrypt timing discussion — Background on bcrypt.compare() timing safety
- Community blog posts on Express 5 async error handling — General guidelines confirm Express 5 behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified via npm registry and official documentation
- Architecture: HIGH - Patterns copied from official docs (node-postgres pool, bcrypt compare)
- Pitfalls: HIGH - All documented in official sources or well-known in community
- PostgreSQL setup: MEDIUM - User opted for manual Windows installer; instructions verified against official PostgreSQL/EDB docs

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (stable packages; 30-day validity)
