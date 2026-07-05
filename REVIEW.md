---
phase: code-review
reviewed: 2026-07-05T12:00:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - src/config.js
  - src/credential.js
  - src/index.html
  - src/main.js
  - src/preload.js
  - src/renderer.js
  - src/server.js
  - src/setup.html
  - src/styles.css
  - src/db/migrate.js
  - src/db/pool.js
  - src/db/schema.sql
  - server/index.js
  - server/package.json
  - scripts/migrate-pin.js
findings:
  critical: 9
  warning: 12
  info: 8
  total: 29
status: issues_found
---

# Phase: Code Review Report

**Reviewed:** 2026-07-05T12:00:00Z
**Depth:** deep (cross-file analysis, import graph, call chains)
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Deep cross-file analysis of a 15-file Electron + Express + PostgreSQL stock management application reveals **29 findings**: 9 critical, 12 warnings, 8 info items. The most severe issues include PINs stored in plaintext on disk, SQL injection via string concatenation in database administration queries, a broken migration script that will crash on execution, XSS via innerHTML in the error handler, and race conditions in the data sync logic. Several architectural concerns exist around rate limiting, authentication bypasses, and cross-file API contract mismatches.

---

## Critical Issues

### CR-01: PIN Stored in Plaintext in Local File  [severity: CRITICAL]

**File:** `src/main.js:173-181`

**Issue:** The `pin:save-local` IPC handler stores the user's PIN in **plaintext** to a JSON file (`stock-pin.json`) in the user data directory. The `pin:verify` handler (line 210-214) performs direct string comparison against this plaintext. Anyone with filesystem access to `%APPDATA%/stock-management/stock-pin.json` can read the PIN. There is no hashing, encryption, or obfuscation at rest.

```js
// Line 175 - plaintext storage
await pinStore.write({ pin: data.pin, tenant_id: data.tenant_id, company_name: data.company_name || "" });

// Line 213 - plaintext comparison
return { valid: !!(stored && stored.pin === pin) };
```

**Impact:** Full account compromise via filesystem read. The PIN unlocks the entire stock management application and can be used to authenticate to the server API remotely.

**Fix:** Hash the PIN with bcrypt (or at minimum PBKDF2/Argon2) before persisting locally. Never store a raw PIN on disk. Use the same hashing approach used on the server side.

```js
// In main.js, add:
const bcrypt = require('bcrypt'); // or use crypto.scryptSync

// pin:save-local:
const hash = await bcrypt.hash(data.pin, 10);
await pinStore.write({ pin_hash: hash, tenant_id: data.tenant_id, company_name: data.company_name || "" });

// pin:verify:
const stored = await pinStore.read();
const valid = stored && stored.pin_hash ? await bcrypt.compare(pin, stored.pin_hash) : false;
return { valid };
```

---

### CR-02: SQL Injection via String Concatenation in Server Database Administration Queries  [severity: CRITICAL]

**File:** `src/server.js:38-39, 253, 258-260, 270, 377`

**Issue:** Multiple database queries use JavaScript string concatenation (`+`) to build SQL statements. While `process.env.DB_USER` and `dbName` (slugified) are not direct user input, the pattern is inconsistent with the parameterized queries used elsewhere and violates secure coding standards. The `repairTenantPermissions` function (lines 38-39) is particularly dangerous because it could be exploited if `DB_USER` contains SQL metacharacters.

```js
// Line 38-39 (repairTenantPermissions)
await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "' + process.env.DB_USER + '"');
await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "' + process.env.DB_USER + '"');

// Line 253 (create tenant)
await suClient.query('CREATE DATABASE "' + dbName + '"');

// Line 258-259 (grant to tenant)
await suTClient.query('GRANT ALL PRIVILEGES ON SCHEMA public TO "' + process.env.DB_USER + '"');
await suTClient.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "' + process.env.DB_USER + '"');

// Line 270 (fallback create)
await tmpClient.query('CREATE DATABASE "' + dbName + '"');

// Line 377 (delete tenant)
await tmpClient.query('DROP DATABASE IF EXISTS "' + req.dbName + '"');
```

Also in `src/db/pool.js:62`:
```js
await adminClient.query('CREATE DATABASE "' + dbName + '"');
```

**Impact:** SQL injection leading to arbitrary query execution, privilege escalation, and potential data loss. If `DB_USER` contains a `"` character, the grant statements will break open to injection.

**Fix:** Use `pg-format` or parameterized identifiers. PostgreSQL does not allow parameterized identifiers in `CREATE DATABASE` or `GRANT` statements, so validate/sanitize the input with a allowlist or escape double-quotes.

```js
// For identifier escaping, create a helper:
function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

// Then use:
await suClient.query('CREATE DATABASE ' + quoteIdent(dbName));
```

---

### CR-03: Broken Import in Migration Script — Will Crash on Execution  [severity: CRITICAL]

**File:** `src/db/migrate.js:3,8`

**Issue:** Line 3 does `const pool = require('./pool');` which imports the exports object `{ masterPool, getTenantPool, ensureMasterDb }` — not a Pool instance. Then line 8 calls `pool.query(...)`, but the imported object has no `.query()` method. This will throw `TypeError: pool.query is not a function` on every execution.

```js
// Line 3: imports an object, not a pool
const pool = require('./pool');  // pool = { masterPool, getTenantPool, ensureMasterDb }

// Line 8: masterPool.query is correct, pool.query is undefined
const check = await pool.query(
  "SELECT value FROM app_settings WHERE key = $1", [MIGRATION_KEY]
);
```

**Impact:** The migration script is completely non-functional. It will crash immediately with a TypeError. The entire data migration path is broken.

**Fix:** Destructure the import correctly and replace all `pool.` references with `masterPool.`:

```js
const { masterPool } = require('./pool');

// Then:
const check = await masterPool.query(
  "SELECT value FROM app_settings WHERE key = $1", [MIGRATION_KEY]
);
```

---

### CR-04: XSS via innerHTML in Error Handler  [severity: CRITICAL]

**File:** `src/renderer.js:835-841`

**Issue:** The `init()` function's catch block writes directly to `document.body.innerHTML` using string concatenation that includes `err.message`. If an error message contains user-influenced data (e.g., a malformed API response, a crafted localStorage value, or attacker-controlled server response), this creates a DOM-based XSS vulnerability.

```js
document.body.innerHTML =
  '<div ...>' +
  '<h2 ...>Something went wrong</h2>' +
  '<p ...>Please restart the application.</p>' +
  '<pre ...>' +
  (err.message || "Unknown error") +
  '</pre></div>';
```

**Impact:** Arbitrary JavaScript execution in the renderer process context if an error message contains HTML/script content. Since the renderer has access to IPC (through preload), this could enable Node.js-level compromise.

**Fix:** Use `textContent` instead of `innerHTML`, or escape the error message:

```js
// Option A: Use DOM methods
const errorDiv = document.createElement('div');
errorDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;text-align:center;padding:40px;';
errorDiv.innerHTML = 
  '<h2 style="color:#f59e0b;margin:0;">Something went wrong</h2>' +
  '<p style="color:#94a3b8;margin:0;">Please restart the application.</p>';
const pre = document.createElement('pre');
pre.style.cssText = 'color:#64748b;font-size:12px;margin-top:8px;';
pre.textContent = err.message || "Unknown error";
errorDiv.appendChild(pre);
document.body.innerHTML = '';
document.body.appendChild(errorDiv);

// Option B: Escape the message
const escaped = escapeHtml(err.message || "Unknown error");
document.body.innerHTML = '<div...><pre>' + escaped + '</pre></div>';
```

---

### CR-05: CORS with Origin Wildcard  [severity: CRITICAL]

**File:** `src/server.js:12`

**Issue:** The Express server sets `cors({ origin: '*' })`, allowing any website to make cross-origin requests. Since the API authenticates via `x-access-pin` headers (sent as custom headers), a malicious website could make requests if it can obtain or guess the PIN.

```js
app.use(cors({ origin: '*' }));
```

**Impact:** Cross-origin read/write access to the stock management API from any website. While the `x-access-pin` header prevents fully trivial CSRF, the wildcard CORS combined with the header-based auth creates an unnecessarily broad attack surface.

**Fix:** Restrict CORS to the Electron app's known origins, or use the `origin` callback to validate requests:

```js
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:*',
  'app://.',
  'file://'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(a => origin.startsWith(a))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
```

---

### CR-06: Missing Rate Limiting on PIN Creation Endpoint  [severity: CRITICAL]

**File:** `src/server.js:102-108, 211-297`

**Issue:** Rate limiting is only applied to `GET /api/pin/verify` (line 102-108). The `POST /api/pin` endpoint (line 211), which creates new tenants with bcrypt-hashed PINs, has no rate limiting. An attacker can brute-force PIN creation attempts or spam the endpoint to exhaust server resources.

```js
// Only this endpoint has rate limiting:
const pinVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });

// POST /api/pin has NO rate limiter
app.post('/api/pin', async (req, res) => { ... });
```

Additionally, `resolveTenant` middleware (used by `/api/entries`, `/api/stock`, etc.) performs PIN verification without any rate limiting, allowing unlimited login attempts on data endpoints.

**Impact:** Unlimited PIN brute-force attempts via data endpoints. Resource exhaustion via bcrypt hash generation on POST /api/pin.

**Fix:** Apply rate limiting to all auth-sensitive endpoints:

```js
const pinCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many PIN creation attempts.' }
});
app.post('/api/pin', pinCreateLimiter, async (req, res) => { ... });

// Also apply to the resolveTenant middleware
```

---

### CR-07: Offscreen PDF Window with Sandbox Disabled  [severity: CRITICAL]

**File:** `src/main.js:295-301`

**Issue:** The PDF export creates a hidden BrowserWindow with `offscreen: true` but `sandbox: false`. While the content is an escaped HTML template, disabling sandbox on a hidden window that loads a `data:` URL creates a privilege escalation path if the HTML content were ever compromised.

```js
const pdfWindow = new BrowserWindow({
  show: false,
  webPreferences: {
    offscreen: true,
    sandbox: false   // <-- dangerous
  }
});
```

**Impact:** A compromised or malicious template (though currently escaped) could access Node.js APIs through the unsandboxed renderer. This is a defense-in-depth violation.

**Fix:** Enable sandboxing and use `viewport` print settings instead:

```js
const pdfWindow = new BrowserWindow({
  show: false,
  webPreferences: {
    offscreen: true,
    sandbox: true    // <-- enable for defense-in-depth
  }
});
```

---

### CR-08: `resolveTenant` Middleware Bypasses Rate Limiting — Authenticated Endpoints Exposed to Brute-Force  [severity: CRITICAL]

**File:** `src/server.js:110-145, 390-470`

**Issue:** The `resolveTenant` middleware (lines 110-145) performs PIN verification (iterating through all tenants and calling `bcrypt.compare`) but has no rate limiting. It is used by `GET /api/entries`, `POST /api/entries`, `GET /api/stock`, and `DELETE /api/pin`. This means an attacker can brute-force PINs on these endpoints without the rate limit that `GET /api/pin/verify` has.

```js
// resolveTenant is used here without rate limiting:
app.get('/api/entries', resolveTenant, async (req, res) => { ... });
app.post('/api/entries', resolveTenant, async (req, res) => { ... });
app.get('/api/stock', resolveTenant, async (req, res) => { ... });
```

**Impact:** The rate limit on `/api/pin/verify` is completely bypassable by targeting `/api/entries` or `/api/stock` instead. Since `resolveTenant` iterates ALL tenant records doing bcrypt compare, this is also a CPU exhaustion vector.

**Fix:** Apply the rate limiter to the `resolveTenant` middleware, or add rate limiting before it:

```js
const globalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many attempts.' }
});

app.use('/api/entries', globalAuthLimiter, resolveTenant);
app.use('/api/stock', globalAuthLimiter, resolveTenant);
```

---

### CR-09: No Input Validation on Server Stock Entry Endpoints  [severity: CRITICAL]

**File:** `src/server.js:416-470`

**Issue:** The `POST /api/entries` endpoint validates that `entries` is an array (line 453), but does **no per-entry field validation**. The `saveEntries` function (line 416) blindly inserts whatever fields are provided. Malformed entries with missing fields, invalid types, negative quantities (despite CHECK constraint), or excessively long strings pass through and may cause database errors or data corruption.

```js
// Only validates array type:
if (!Array.isArray(entries)) {
  return res.status(400).json({ error: 'entries must be an array' });
}

// No per-entry validation before insert:
for (const entry of entries) {
  await client.query(
    `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ...`,
    [entry.id, entry.date, entry.type, entry.item, entry.category || '',
     entry.quantity, entry.rate, entry.note || '', entry.createdAt || new Date().toISOString()]
  );
}
```

**Impact:** Insertion of invalid data, database constraint violations, potential data loss. The transaction wraps the entire operation, so one bad entry causes the entire batch to roll back, losing all entries.

**Fix:** Add per-entry validation:

```js
function validateEntry(entry) {
  if (!entry.id || typeof entry.id !== 'string') return 'Invalid entry ID';
  if (!entry.date || isNaN(Date.parse(entry.date))) return 'Invalid date';
  if (!['in', 'out'].includes(entry.type)) return 'Invalid type';
  if (!entry.item || entry.item.length > 255) return 'Invalid item name';
  if (typeof entry.quantity !== 'number' || entry.quantity <= 0) return 'Invalid quantity';
  if (typeof entry.rate !== 'number' || entry.rate < 0) return 'Invalid rate';
  return null;
}

// In saveEntries:
for (const entry of entries) {
  const err = validateEntry(entry);
  if (err) {
    await client.query('ROLLBACK');
    throw new Error(err);
  }
}
```

---

## Warnings

### WR-01: Race Condition in Data Sync Logic Between save() and updateStatus()

**File:** `src/renderer.js:380-391, 441-454`

**Issue:** The `save()` function (line 441) sets `_dirty = true` and then POSTs to the server asynchronously. The `updateStatus()` function (line 380) checks `_dirty` and also POSTs when the server returns online. If both execute concurrently, they can send overlapping POST requests to the server. The server's `saveEntries` function (server.js line 416) does `DELETE FROM stock_entries` then reinserts inside a transaction — but two concurrent transactions can cause one to overwrite the other's data.

```js
// save() - line 441
const save = async () => {
  await window.stockApi.save({ entries: state.entries });
  _dirty = true;
  const res = await fetch(`${API}/entries`, { method: "POST", ... });
  if (res.ok) _dirty = false;  // <-- _dirty still true until this resolves
};

// updateStatus() - line 380
if (serverOk && !_prevServerOk && _dirty) {
  _dirty = false;
  await fetch(`${API}/entries`, { method: "POST", ... });  // <-- may race with save()
}
```

**Impact:** Data loss — one sync operation can wipe out entries that were added by another. The `DELETE FROM stock_entries` in the server transaction is destructive.

**Fix:** Use a lock/mutex pattern to prevent concurrent syncs:

```js
let _syncing = false;

const syncToServer = async () => {
  if (_syncing) return;
  _syncing = true;
  try {
    const headers = { "Content-Type": "application/json", "x-access-pin": _currentPin };
    if (_deviceToken) headers["x-device-token"] = _deviceToken;
    const res = await fetch(`${API}/entries`, {
      method: "POST", headers,
      body: JSON.stringify({ entries: state.entries })
    });
    if (res.ok) _dirty = false;
  } finally {
    _syncing = false;
  }
};

const save = async () => {
  await window.stockApi.save({ entries: state.entries });
  _dirty = true;
  await syncToServer();
};
```

---

### WR-02: `createdAt` localeCompare Can Throw on Undefined Values

**File:** `src/renderer.js:532, 561`

**Issue:** Both `renderReportRows` (line 532) and `getReportRows` (line 561) sort entries by `createdAt` using `localeCompare`. If any entry lacks a `createdAt` field (e.g., entries from older data files or malformed entries), calling `.localeCompare()` on `undefined` throws a `TypeError`.

```js
.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
// If b.createdAt is undefined: TypeError: Cannot read properties of undefined
```

**Impact:** The report view will crash and become unrendered if any legacy entry lacks `createdAt`.

**Fix:** Provide a fallback:

```js
.sort((a, b) => {
  const aDate = a.createdAt || a.date || '1970-01-01';
  const bDate = b.createdAt || b.date || '1970-01-01';
  return bDate.localeCompare(aDate);
});
```

---

### WR-03: No HTTPS Redirect Enforcement — Fallback to HTTP

**File:** `server/index.js:39-56`

**Issue:** The HTTPS redirect (line 48) only activates when SSL certificates are present. When they are not found, the server falls back to plain HTTP on the main port (443) and serves the API without encryption. The HTTP server is also started without any error handler.

```js
if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  // HTTPS server
} else {
  console.log('SSL certificates not found, starting HTTP server');
  app.listen(PORT, '0.0.0.0', () => { ... });  // API on HTTP!
}
```

**Impact:** Plaintext transmission of PIN, TOTP codes, device tokens, and stock data over the network. Active MITM attacks can intercept credentials.

**Fix:** Refuse to start without SSL, or always bind HTTPS and fail hard:

```js
if (!certPath || !keyPath || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('SSL certificates required. Set SSL_CERT_PATH and SSL_KEY_PATH in .env');
  process.exit(1);
}
```

---

### WR-04: Unauthenticated Endpoint Exposes Tenant Company Names

**File:** `src/server.js:147-157`

**Issue:** `GET /api/pin/status` requires no authentication and returns the company name of the first registered tenant. This leaks organizational information to unauthenticated callers.

```js
app.get('/api/pin/status', async (req, res) => {
  const result = await masterPool.query(
    "SELECT COUNT(*) AS count, COALESCE((SELECT company_name FROM tenants ORDER BY created_at ASC LIMIT 1), '') AS company_name FROM tenants"
  );
  res.json({ configured: ..., company_name: result.rows[0].company_name });
});
```

**Impact:** Information disclosure — any user can determine whether the application is in use and the company name.

**Fix:** Remove company_name from the unauthenticated response, or add basic rate limiting:

```js
res.json({ configured: parseInt(result.rows[0].count) > 0 });
```

---

### WR-05: TOTP Secret Exposed in QR Code Response During PIN Setup

**File:** `src/server.js:284, src/renderer.js:189-193, 191`

**Issue:** The QR code response from `POST /api/pin` contains the full `otpauth_url` (which includes the TOTP secret) encoded into a base64 data URL. The renderer displays this in an `<img>` tag. If the response is intercepted (it's served over HTTP if SSL is not configured), the attacker obtains the TOTP secret and can generate valid 2FA codes.

```js
// server.js:284
const qrCodeDataUrl = await QRCode.toDataURL(totpSecret.otpauth_url);
// otpauth_url contains: otpauth://totp/Secret:...?secret=THISISTHESECRET&issuer=...

// renderer.js:191
qrImg.src = qrCodeDataUrl;  // QR code displayed in DOM
```

**Impact:** TOTP bypass — anyone who intercepts the QR code data URL can generate valid TOTP codes without the authenticator app.

**Fix:** Serve the QR code as a separate, one-time HTTP response that is not logged, or display a manual entry key instead of the full QR code data URL.

---

### WR-06: Express v5 Breaking Changes Not Accounted For

**File:** `server/package.json:14`

**Issue:** The project depends on `"express": "^5.2.1"`. Express 5 has several breaking changes from Express 4, including:
- Async error handling (thrown errors in async handlers are caught differently)
- `path` route matching changes (strict vs loose)
- `res.send()` behavior changes
- `req.query` parsing changes

The error handler middleware (server.js line 488) and route handlers were likely written for Express 4 patterns.

**Impact:** Potential silent failures, unhandled errors, or middleware execution order issues at runtime.

**Fix:** Pin Express to a specific major version and test thoroughly. Either downgrade to Express 4 (stable and well-documented) or audit all routes for Express 5 compatibility:

```json
"express": "^4.21.0"
```

---

### WR-07: Double `unlockApp()` Invocations on PIN Setup Failure Path

**File:** `src/renderer.js:275-281`

**Issue:** When PIN setup succeeds (no TOTP), `unlockApp()` is called at line 277. If the subsequent server call encounters an error (line 278 catch block), `unlockApp()` is called AGAIN at line 281. While the Promise can only resolve once, this double-call pattern indicates a logic flaw that could cause unexpected UI behavior.

```js
_currentPin = pin;
await window.stockApi.savePinLocal({ pin, ... });
unlockApp();                          // Line 277 - first call
} catch (e) {
  await window.stockApi.savePinLocal({ pin, ... });
  _currentPin = pin;
  unlockApp();                        // Line 281 - second call (if error)
}
```

**Impact:** The second `_unlock()` call is harmless (resolved promise ignores subsequent calls), but the gate is hidden and app shell is shown on a potentially incomplete setup path.

**Fix:** Add a guard:

```js
let _unlocked = false;
const unlockApp = () => {
  if (_unlocked) return;
  _unlocked = true;
  // ... rest of unlockApp
};
```

---

### WR-08: Uncaught Exception Handler Suppresses Process Exit

**File:** `src/main.js:4-6`

**Issue:** The `uncaughtException` handler logs the error but does not exit the process. Node.js documentation explicitly warns against this — the application is left in an indeterminate state.

```js
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // No process.exit() — app continues in broken state
});
```

**Impact:** Data corruption, undefined behavior. The Electron app continues running with corrupted state after a crash.

**Fix:** Log and exit, or use a more targeted error handler:

```js
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Perform cleanup, then exit
  app.quit();
  process.exit(1);
});
```

---

### WR-09: Missing Error Handler on HTTP Server

**File:** `server/index.js:46`

**Issue:** The HTTP redirect server (and the main app.listen for HTTP fallback) is started without an error handler. If the port is unavailable (EADDRINUSE), the unhandled error causes the process to crash with a generic error.

```js
http.createServer((req, res) => { ... })
  .listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('HTTP redirect server running on port ' + HTTP_PORT);
  });
// No .on('error') handler!
```

**Impact:** Process crashes with unhelpful error if port is occupied.

**Fix:** Add error listeners:

```js
const httpServer = http.createServer((req, res) => { ... });
httpServer.listen(HTTP_PORT, '0.0.0.0');
httpServer.on('error', (err) => {
  console.error('HTTP server error:', err.message);
});
```

---

### WR-10: No Content Security Policy (CSP) Headers

**File:** `src/index.html` (all), `src/server.js` (no middleware)

**Issue:** Neither the Electron HTML shell nor the Express server set Content-Security-Policy headers. Without CSP, the application is more vulnerable to XSS attacks (especially given the innerHTML usage in renderer.js).

**Impact:** XSS exploits are not mitigated by CSP. An attacker who can inject scripts can execute them without restriction.

**Fix:** Add CSP meta tag in index.html:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:* https://*;" />
```

And add CSP middleware in server.js:

```js
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

---

### WR-11: Device Token Bypasses TOTP Forever — No Token Revocation

**File:** `src/server.js:185-193, 342-348`, `src/renderer.js:294-298`

**Issue:** Once a device token is issued (crypto.randomBytes(32) at server.js:342), it is stored in the config file and sent on every request. There is no token expiration, no revocation mechanism, and no limit on how many trusted devices a tenant can register. If the device token is leaked, the attacker can bypass TOTP indefinitely.

```js
// server.js:185-193 — if device token is valid, skip TOTP
if (deviceToken) {
  const device = await masterPool.query(
    "SELECT id FROM trusted_devices WHERE tenant_id = $1 AND device_token = $2",
    [match.tenant_id, deviceToken]
  );
  deviceTrusted = device.rows.length > 0;
}
```

**Impact:** Compromised device token grants permanent TOTP bypass with no possibility of revocation.

**Fix:** Add token expiration and a revocation endpoint:

```sql
ALTER TABLE trusted_devices ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days';
```

```js
// Check expiration
if (device.rows.length > 0 && device.rows[0].expires_at > new Date()) {
  deviceTrusted = true;
}
```

---

### WR-12: Missing `db_name` Column in `schema.sql` vs Runtime Schema

**File:** `src/db/schema.sql:31-36` vs `src/db/pool.js:72-82`

**Issue:** The `schema.sql` file defines the `tenants` table without `db_name`, `totp_secret`, or `totp_enabled` columns. The actual runtime schema in `pool.js` includes all three. The `stock_entries` table in `schema.sql` has a `tenant` column and `VARCHAR(3)` for `type`, while the runtime in `server.js` uses `VARCHAR(10)` and no tenant column. The schema documentation is significantly out of date.

```sql
-- schema.sql tenants table (line 31-36)
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id UUID PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  company_name VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- MISSING: db_name, totp_secret, totp_enabled
```

**Impact:** Confusion for maintainers. Using `schema.sql` as a reference would produce an incorrect database schema.

**Fix:** Update `schema.sql` to match the runtime schema in `pool.js` and `server.js`.

---

## Info

### IN-01: Hardcoded Placeholder API URL

**File:** `src/config.js:3`

**Issue:** The API URL is hardcoded as `"https://api.mystock.com"` — a placeholder that must be changed before building.

```js
const API_URL = "https://api.mystock.com";
```

**Fix:** Read from environment variable with a more meaningful default, or document the build-time configuration requirement.

---

### IN-02: Dead Code — `credential.js` Not Imported Anywhere

**File:** `src/credential.js:1-35`

**Issue:** The file exports `save`, `load`, `has`, and `remove` functions, but a grep for `require.*credential` across all source files returns zero matches. No file in the project imports this module. It also uses `"app-config.json"` as the config file name, which conflicts with the `CONFIG_FILE` constant in `main.js` (also `"app-config.json"`).

**Impact:** Dead code adds maintenance burden. If used in the future, the filename collision with `main.js:15` would cause data corruption.

**Fix:** Either remove the file or integrate it. If kept, rename the constant to avoid collision:

```js
const CONFIG_FILE = "credential-config.json";
```

---

### IN-03: Duplicate Preload API Aliases

**File:** `src/preload.js:13-16`

**Issue:** The preload exposes both `loadDataLocal`/`saveDataLocal` and `load`/`save` which invoke the exact same IPC handlers. The `load`/`save` aliases are redundant.

```js
loadDataLocal: () => ipcRenderer.invoke("data:load-local"),
saveDataLocal: (data) => ipcRenderer.invoke("data:save-local", data),
load: () => ipcRenderer.invoke("data:load-local"),
save: (data) => ipcRenderer.invoke("data:save-local", data),
```

**Fix:** Remove the redundant aliases and use only one naming convention throughout:

```js
loadDataLocal: () => ipcRenderer.invoke("data:load-local"),
saveDataLocal: (data) => ipcRenderer.invoke("data:save-local", data),
```

---

### IN-04: Magic Numbers and Hardcoded Constants

**File:** `src/renderer.js:91, 101-114`

**Issue:** Several hardcoded numbers appear without named constants:
- Line 91: `setTimeout` timer of 8000ms for PIN gate auto-show
- Line 102: `pollStatus(3)` — hardcoded retry count
- Line 110: `setTimeout(r, 1000)` — hardcoded 1-second interval
- Line 832: `setInterval(updateStatus, 30000)` — hardcoded 30-second poll interval

```js
let gateTimer = setTimeout(() => { ... }, 8000);    // What is 8000?
const pollStatus = async (retries) => { ... };       // Called with 3
for (let i = 0; i < retries; i++) { ... }
await new Promise(r => setTimeout(r, 1000));          // What is 1000?
setInterval(updateStatus, 30000);                     // What is 30000?
```

**Fix:** Define named constants at the top of the file:

```js
const PIN_GATE_DELAY_MS = 8000;
const STATUS_POLL_RETRIES = 3;
const STATUS_POLL_INTERVAL_MS = 1000;
const STATUS_REFRESH_INTERVAL_MS = 30000;
```

---

### IN-05: `handlePinSetup` Stores PIN Locally Even on Complete Server Failure

**File:** `src/renderer.js:278-281`

**Issue:** When the entire POST /api/pin server request fails (network error), the catch block saves the PIN locally and unlocks the app. The PIN was never registered on the server. On next startup, if the server is available, the locally stored PIN won't match any server record.

```js
} catch (e) {
  await window.stockApi.savePinLocal({ pin, company_name: state.companyName });
  _currentPin = pin;
  unlockApp();  // App unlocks with unregistered PIN
}
```

**Fix:** Show an error message instead of silently continuing:

```js
} catch (e) {
  msg.textContent = "Server unreachable. Please try again when connected.";
  qs("#setupPin").value = "";
  qs("#setupPinConfirm").value = "";
}
```

---

### IN-06: No Gitignore for `.env` File

**File:** `.gitignore` (presumed missing)

**Issue:** The project root has a `.env` file (visible in directory listing). This file likely contains `DB_USER`, `DB_PASSWORD`, `DB_SUPER_PASSWORD`, and other secrets. The `.env` should be in `.gitignore` to prevent accidental commits.

**Impact:** Secret leakage if the repository is pushed to a remote.

**Fix:** Verify `.gitignore` includes `.env`:

```gitignore
.env
.env.local
.env.*.local
```

---

### IN-07: schema.sql Out of Sync with Runtime Implementation

**File:** `src/db/schema.sql` (all), `src/db/pool.js:72-82`, `src/server.js:66-91`

**Issue:** The `schema.sql` file serves as the database schema reference but has multiple discrepancies with the actual runtime tables:
1. `tenants` table missing `db_name`, `totp_secret`, `totp_enabled` columns
2. `stock_entries` type column is `VARCHAR(3)` vs runtime `VARCHAR(10)`
3. `stock_entries` has `tenant` column not used at runtime
4. `stock_balance` view in schema.sql uses `MAX(...) FILTER (WHERE type='in')` for latest_rate, while server.js (line 86-88) uses a correlated subquery

**Fix:** Regenerate `schema.sql` from the actual runtime definitions.

---

### IN-08: Commented-Out / Empty State Files

**File:** `src/setup.html` (if empty), various

**Issue:** The `src/setup.html` file exists but no review confirms its contents. The `src/credential.js` file is entirely dead code. These orphaned files suggest incomplete cleanup.

**Fix:** Audit and remove or document all orphaned files.

---

_Reviewed: 2026-07-05T12:00:00Z_
_Reviewer: gsd-code-reviewer (deep analysis)_
_Depth: deep_
