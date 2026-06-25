---
phase: 01-postgresql-api-foundation
reviewed: 2026-06-25T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/db/pool.js
  - src/db/schema.sql
  - src/db/migrate.js
  - src/server.js
  - tests/setup.js
  - tests/db/connection.test.js
  - tests/routes/pin.test.js
  - tests/routes/stock.test.js
  - .env.example
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-25
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the PostgreSQL API foundation layer: connection pool, schema DDL, migration script, Express server with PIN auth and stock endpoints, and associated test suites. The implementation is well-structured overall — idempotent DDL, proper transaction handling in migration, sensible error responses that don't leak DB details, and the `dbAvailable` guard pattern in tests is consistently applied. However, one critical configuration bug prevents the pool from honoring `.env` database settings, and a security gap allows rate-limiter bypass on the stock endpoint.

## Critical Issues

### CR-01: Connection pool ignores all .env database variables

**File:** `src/db/pool.js:4-8`
**Issue:** The `Pool` constructor receives only pool-size and timeout settings. It never passes `host`, `port`, `database`, `user`, or `password` from the environment. The `pg` library's built-in env-var support reads `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` — but `.env.example` documents `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, which the `pg` library does **not** read. A user following `.env.example` would configure their database connection and the pool would still connect to `localhost:5432` with the OS-default user and database.

Confirmed: `grep` for `DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|PGHOST|PGPORT` across all of `src/` returns zero matches — no code anywhere reads these values.

**Fix:**
```js
// src/db/pool.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST,
  port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
  database: process.env.DB_NAME || process.env.PGDATABASE,
  user: process.env.DB_USER || process.env.PGUSER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

Alternatively, change `.env.example` to use the `PG*` variables that `pg` reads natively and remove the explicit config from the Pool constructor. Either way, the documented config and the runtime config must agree.

## Warnings

### WR-01: Rate limiter bypassed on /api/stock — unlimited PIN brute-force

**File:** `src/server.js:108,112`
**Issue:** `pinVerifyLimiter` is applied only to `GET /api/pin/verify` (line 108). The `verifyPin` middleware is also mounted on `GET /api/stock` (line 112) **without** the rate limiter. An attacker can brute-force the PIN by sending requests to `/api/stock` with different `x-access-pin` headers — each wrong attempt returns 401 with no rate limit enforced. This effectively undermines the PIN protection on the stock data endpoint.

**Fix:** Apply the rate limiter to `verifyPin` itself, or apply `pinVerifyLimiter` to all routes that use `verifyPin`:

```js
// Option A: Apply limiter to the middleware globally
app.get('/api/stock', pinVerifyLimiter, verifyPin, async (req, res) => { ... });

// Option B (preferred): Create a router-level limiter
const protectedApi = express.Router();
protectedApi.use(pinVerifyLimiter);
protectedApi.use(verifyPin);
protectedApi.get('/pin/verify', (req, res) => { res.json({ valid: true }); });
protectedApi.get('/stock', async (req, res) => { ... });
app.use('/api', protectedApi);
```

### WR-02: CORS allows all origins

**File:** `src/server.js:9`
**Issue:** `app.use(cors({ origin: '*' }))` combined with `app.listen(port, '0.0.0.0')` (line 17) means any device on the network can make cross-origin requests to the API. For a stock management application containing business-sensitive inventory data, this is a security gap. An attacker on the same network can exfiltrate stock data or brute-force the PIN from a malicious web page via browser JS.

**Fix:** Restrict CORS to the Electron app's origin or `null` (for `file://` protocol used by Electron):

```js
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'null',  // Electron file:// origin
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'x-access-pin'],
}));
```

Or if serving from a known localhost port in dev:
```js
app.use(cors({
  origin: ['http://localhost:3000', 'null'],
}));
```

## Info

### IN-01: Redundant bcrypt dependencies with inconsistent imports

**File:** `package.json:53-54`, `src/server.js:3`, `tests/routes/pin.test.js:4`, `tests/routes/stock.test.js:19`
**Issue:** Both `bcrypt` (native C++ addon, v6.0.0) and `bcryptjs` (pure JS, v3.0.3) are listed as dependencies. `server.js` and `pin.test.js` use `require('bcryptjs')`, while `stock.test.js` line 19 uses `require('bcrypt')`. The native `bcrypt` package requires a build toolchain (node-gyp, Python, C++ compiler) which complicates installation and CI, while `bcryptjs` is the dependency already chosen for production code. Having both is redundant and the inconsistent imports are confusing.

**Fix:** Remove `bcrypt` from `package.json` dependencies and change `stock.test.js` to use `bcryptjs`:
```js
// tests/routes/stock.test.js line 4 — add import
const bcrypt = require('bcryptjs');
// line 19 — change to:
testPinHash = await bcrypt.hash(TEST_PIN, 10);
```

### IN-02: stock_balance view `latest_rate` is actually MAX rate, not most recent

**File:** `src/db/schema.sql:36`
**Issue:** The column named `latest_rate` computes `MAX(CASE WHEN type = 'in' THEN rate ELSE 0 END) FILTER (WHERE type = 'in')`, which is the **maximum** `in`-entry rate, not the rate from the most recent entry. The name suggests recency but the aggregation is `MAX`. If a user bought at $10, then at $5, `latest_rate` would be $10 — which may confuse users expecting the most recent purchase price. (This mirrors the desktop app logic per the comment, so it may be intentionally preserved.)

**Fix:** Either rename to `max_rate` to accurately describe the aggregation, or if "most recent" is intended, use a window function:
```sql
-- If max rate is intended, rename:
MAX(CASE WHEN type = 'in' THEN rate ELSE 0 END) FILTER (WHERE type = 'in') AS max_rate

-- If most recent rate is intended:
(DISTINCT ON (item, category) rate
 FROM stock_entries WHERE type = 'in'
 ORDER BY item, category, date DESC, created_at DESC) AS latest_rate
```

### IN-03: stock.test.js test structure makes failures hard to diagnose

**File:** `tests/routes/stock.test.js:61-204`
**Issue:** Six logical tests are implemented as `forEach` iterations of a single `it()` block with `if (testNum === N)` branching inside. This means: (a) a failure in test 3 aborts tests 4-6; (b) `node:test` reports all six as a single test pass/fail; (c) stack traces point to the shared `it()` block, not the specific scenario. The `dbAvailable` guard is also duplicated inside every branch instead of being checked once at the `it()` level.

**Fix:** Split into independent `it()` blocks:
```js
it('returns array of items with all required fields', async () => {
  if (!dbAvailable) return;
  await ensurePin();
  // ... insert and assert
});

it('computes balance correctly (in - out)', async () => {
  if (!dbAvailable) return;
  await ensurePin();
  // ... insert and assert
});
// etc.
```

---

_Reviewed: 2026-06-25_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
