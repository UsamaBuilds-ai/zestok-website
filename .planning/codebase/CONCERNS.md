# Codebase Concerns

**Analysis Date:** 2026-07-07

## Tech Debt

### Untracked Critical Source Files in .gitignore

**Issue:** The `.gitignore` file excludes `src/db/` and `src/config.js` from version control. These files contain the database migration logic (`src/db/pool.js`, `src/db/migrate.js`, `src/db/schema.sql`) and the API URL configuration (`src/config.js`). Any developer cloning the repository will not receive these files and the application will fail to run.

**Files:**
- `.gitignore` (line 8, 9)
- `src/db/pool.js`
- `src/db/migrate.js`
- `src/db/schema.sql`
- `src/config.js`

**Impact:** The repo cannot be rebuilt from source. Missing critical files mean the application is un-runnable after a fresh clone. This defeats the purpose of version control.

**Fix approach:** Remove `src/db/` and `src/config.js` from `.gitignore`. Replace hardcoded secrets in `src/config.js` with environment variable fallbacks. Add a `.env.example` template for required configuration.

### Dead Code — credential.js Module Never Imported

**Issue:** The file `src/credential.js` exports `save`, `load`, `has`, and `remove` functions but is never imported anywhere in the codebase. It also uses `"credential-config.json"` as its filename, but `src/main.js` uses `"app-config.json"` for similar purposes, suggesting this was an abandoned refactor.

**Files:**
- `src/credential.js` (entire file, 35 lines)

**Impact:** 35 lines of dead code create maintenance overhead. If someone later imports this without noticing the filename collision, it will corrupt `main.js`'s config storage.

**Fix approach:** Remove `src/credential.js` entirely, or integrate it with the existing config store in `src/main.js`.

### Duplicate Preload API Aliases

**Issue:** `src/preload.js` exposes both `loadDataLocal`/`saveDataLocal` and `load`/`save` which invoke the identical IPC handlers. The `load`/`save` aliases are redundant and unused by the renderer.

**Files:**
- `src/preload.js` (lines 13-16)

**Impact:** Confusion for maintainers — ambiguous which API to use.

**Fix approach:** Remove the redundant `load`/`save` aliases; keep only `loadDataLocal`/`saveDataLocal`.

### Log Files Tracked in Git

**Issue:** `server_err.log` and `server_out.log` are committed to the git repository. While currently 0 bytes, log files should never be version-controlled — they bloat the repo and may contain sensitive error output.

**Files:**
- `server_err.log` (tracked in git)
- `server_out.log` (tracked in git)

**Impact:** Eventual repository bloat if logs grow. Potential information leakage if errors include query parameters or stack traces with data.

**Fix approach:** Add `server_*.log` to `.gitignore` and remove from git tracking with `git rm --cached`.

### schema.sql Out of Sync with Runtime Implementation

**Issue:** `src/db/schema.sql` contains table definitions that differ from the actual runtime schemas in `src/db/pool.js` and `src/server.js`. The `tenants` table definition is missing `db_name`, `totp_secret`, and `totp_enabled` columns. The `stock_entries` table uses `VARCHAR(3)` for `type` instead of `VARCHAR(10)`. The `stock_balance` view uses a different query pattern than the runtime code.

**Files:**
- `src/db/schema.sql` (lines 29-37, 2-12)
- `src/db/pool.js` (lines 76-82)
- `src/server.js` (lines 88-113)

**Impact:** Maintenance confusion. Anyone using `schema.sql` as a reference will create an incorrect database.

**Fix approach:** Regenerate `schema.sql` from the actual runtime schema definitions in `pool.js` and `server.js`.

### Unused Capacitor Dependency

**Issue:** `@capacitor/android` is listed as a dependency in `package.json` but no Capacitor configuration or mobile-related code exists in the codebase. The `capacitor.config.json` file was recently removed from tracking (commit `0fe34f8`).

**Files:**
- `package.json` (line 72)
- `capacitor.config.json` (removed from git in recent commit)

**Impact:** Unnecessary dependency bloat. The `npm install` will download Java/Android-related packages despite zero mobile code.

**Fix approach:** Remove `@capacitor/android` from dependencies.

### Migration Script Uses Wrong Default Port

**Issue:** `src/db/pool.js` defaults DB port to 5454, but `src/server.js` falls back to port 5432 in the non-superuser database creation path (lines 303-305). This inconsistency means tenant database creation may fail silently if the PostgreSQL instance runs on port 5454 with no superuser credentials.

**Files:**
- `src/server.js` (lines 303-305)
- `src/db/pool.js` (line 8)

**Impact:** Intermittent tenant creation failures when superuser credentials are not configured.

**Fix approach:** Use a consistent port variable extracted once from environment, with a single default.

## Security Considerations

### HTTP Fallback When SSL Certificates Missing

**Issue:** When SSL certificate paths are not set in the environment, `server/index.js` falls back to plain HTTP serving on port 3000. All traffic — including PIN verification, TOTP codes, device tokens, and stock data — is transmitted in cleartext. An active MITM attacker can intercept credentials.

**Files:**
- `server/index.js` (lines 54-61)

**Risk:** Active MITM attack can capture PINs, TOTP secrets, and device tokens, granting full API access. The app is designed for cloud deployment (Oracle Cloud per `server/package.json`), making MITM a realistic threat.

**Current mitigation:** None. Server silently falls back to HTTP with no warning.

**Recommendations:** Refuse to start without SSL, or enforce HTTPS with a redirect-only HTTP server. At minimum, log a severe warning:
```js
if (!certPath || !keyPath || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('FATAL: SSL certificates required. Set SSL_CERT_PATH and SSL_KEY_PATH');
  process.exit(1);
}
```

### Unauthenticated Endpoint Exposes Company Name

**Issue:** `GET /api/pin/status` requires no authentication and returns the company name of the first registered tenant. This leaks organizational identity to unauthenticated callers.

**Files:**
- `src/server.js` (lines 185-198)

**Risk:** Information disclosure — any unauthenticated requester can determine whether the application is in use and the company name. This aids targeted attacks.

**Current mitigation:** Only the first tenant's company name is returned, but this is still a leak.

**Recommendations:** Remove company_name from the unauthenticated response. Return only `{ configured: true/false }`.

### TOTP Secret Exposed in QR Code Response

**Issue:** The `POST /api/pin` response includes `totpQrCode` — a base64 data URL of the QR code containing the full `otpauth_url`, which embeds the TOTP secret. If the API response is intercepted (especially over HTTP), the attacker can generate valid TOTP codes.

**Files:**
- `src/server.js` (line 325)
- `src/renderer.js` (lines 247-248)

**Risk:** TOTP bypass — anyone who intercepts the QR code data URL can generate valid 2FA codes without the authenticator app. The secret is also stored in the database (`totp_secret` column) without encryption at rest.

**Current mitigation:** The QR code is only returned once during PIN setup. However, if the setup occurs over HTTP (see HTTP fallback issue), it is fully exposed.

**Recommendations:** Deliver the QR code over a separate, one-time endpoint with additional verification. Hash or encrypt the `totp_secret` at rest in the database.

### Device Tokens Have No Expiration or Revocation

**Issue:** Device tokens issued after TOTP verification (`crypto.randomBytes(32)`) are stored permanently with no expiration. The `trusted_devices` table has no `expires_at` column. There is no endpoint to revoke a trusted device. If a device token is leaked, an attacker can bypass TOTP indefinitely.

**Files:**
- `src/server.js` (lines 226-233, 383-389, 421)

**Risk:** A compromised device token provides permanent TOTP bypass. No administrative interface exists to revoke tokens.

**Current mitigation:** Tokens are 64-character hex strings (256 bits of entropy), making random guessing infeasible. However, they can be stolen from the local config file or intercepted over the network.

**Recommendations:** Add an expiration date to device tokens (e.g., 90 days). Add a revocation endpoint. Store only a hash of the device token, not the raw token.

### Hardcoded Public IP Address in Config

**Issue:** `src/config.js` hardcodes `http://84.235.249.239:3000` as the default API URL. This is a publicly routable IP address, not a placeholder. If the application is distributed or shared, users will attempt to connect to this external server by default.

**Files:**
- `src/config.js` (line 2)

**Risk:** Users may unknowingly send stock data to an external server. The IP is served over HTTP (not HTTPS), meaning all data is in cleartext. This creates both a security and privacy concern.

**Current mitigation:** The environment variable `API_URL` overrides the default, and the renderer reads from local config first.

**Recommendations:** Replace the public IP with a localhost default (`http://localhost:3000`) or empty string that forces user configuration during setup.

### CSP Allows `unsafe-inline` Styles

**Issue:** The Content-Security-Policy meta tag in `index.html` allows `style-src 'self' 'unsafe-inline'`, which while common, weakens the CSP against CSS-based data exfiltration attacks.

**Files:**
- `src/index.html` (line 9)

**Risk:** CSS injection attacks (though low probability given the app context).

**Current mitigation:** `script-src 'self'` prevents inline script execution, which is the primary XSS vector.

**Recommendations:** Use a nonce or hash-based approach for inline styles, or move all styles to the external CSS file.

## Performance Bottlenecks

### Full-Replace Save Strategy Causes Data Loss Risk

**Issue:** The `saveEntries` function in `src/server.js` (lines 467-508) executes `DELETE FROM stock_entries` followed by re-insertion of all entries inside a transaction. This is an all-or-nothing replace strategy. If two clients (or the desktop app's `save()` and `syncToServer()`) send concurrent requests, one client's data will overwrite the other's because the full dataset is replaced each time.

**Files:**
- `src/server.js` (lines 467-508)
- `src/renderer.js` (lines 449-469)

**Problem:** As the dataset grows, this approach becomes increasingly slow. Transactions lock the table for the full duration. Concurrent syncs from multiple devices can cause data loss — the `DELETE` + `INSERT` inside a transaction means whichever request finishes last wins, wiping out earlier entries.

**Improvement path:**
1. Use individual `INSERT ... ON CONFLICT` for each entry without the blanket `DELETE`.
2. Add a `last_synced_at` timestamp to the client to enable incremental sync.
3. Use row-level conflict resolution instead of full-replace.

### bcrypt Compare Iterates ALL Tenants

**Issue:** The `resolveTenant` middleware and `GET /api/pin/verify` endpoint iterate through ALL tenant records, calling `bcrypt.compare` for each one until a match is found. With many tenants, this becomes CPU-intensive (bcrypt is deliberately slow).

**Files:**
- `src/server.js` (lines 158-168, 210-220, 352-362)

**Problem:** O(n) bcrypt operations per authentication request. With 100 tenants, each login requires 100 bcrypt comparisons (each taking ~100ms), resulting in multi-second authentication latency.

**Improvement path:** Add a `pin_hash_prefix` column (first 4 characters of the hash) and index it to narrow candidates before doing bcrypt compare. Or use a keyed hash as a lookup index.

### No Pagination on Entry Endpoints

**Issue:** `GET /api/entries` returns ALL stock entries without pagination. As the dataset grows, this will consume increasing memory and bandwidth for both server and client.

**Files:**
- `src/server.js` (lines 431-437)

**Problem:** A tenant with 100,000 entries will receive them all in a single response. The client stores all entries in memory (`state.entries`).

**Improvement path:** Add `LIMIT`/`OFFSET` or cursor-based pagination to the entries endpoint, and maintain a working window in the renderer.

## Fragile Areas

### Server Entry Save — Transaction-Level Error Handling

**Issue:** The `saveEntries` function wraps the entire `DELETE` + re-`INSERT` in a transaction. If any entry is invalid, the entire batch fails and rolls back. Combined with the lack of a server-side lock, concurrent requests can leave the database in an inconsistent state if one fails mid-way through.

**Files:**
- `src/server.js` (lines 467-508)

**Why fragile:** Single invalid entry in a batch of 1000 causes total data loss for that save. The client has no retry logic for partial failures.

**Test coverage:** No tests exist for this function (entire codebase has zero tests).

### PIN Setup Race — Missing Server Confirmation

**Issue:** In the renderer's `handlePinSetup` (now fixed to show error on failure), the success path saves the PIN locally only after server confirmation. However, the connection between local PIN storage and server validation is fragile — a user could clear local data, and if the server is unreachable, they'd need to know their PIN to re-authenticate locally but the local PIN file might be corrupted.

**Files:**
- `src/renderer.js` (lines 213-298)
- `src/main.js` (lines 176-218)

**Why fragile:** The two-factor local/server PIN model has subtle edge cases:
- Local PIN stored with bcrypt hash (good)
- But local verification is used ONLY as fallback when server is offline
- If local PIN is corrupted and server is offline, user is locked out entirely

### Express v5 Breaking Changes Not Accounted For

**Issue:** The project depends on `"express": "^5.2.1"`. Express 5 has breaking changes from Express 4 in error handling (async error catching), route path matching, and middleware execution order. The error handler at line 547-556 and route handlers were designed without Express 5's specific behavior in mind.

**Files:**
- `server/package.json` (line 14)
- `src/server.js` (lines 547-556)

**Why fragile:** Async handler errors may not be caught by Express 5's error middleware the same way as Express 4. Silent failures and unhandled promise rejections may occur in production without visible symptoms.

### No Test Coverage Anywhere

**Issue:** The entire codebase has zero test files. The `package.json` declares a `test` script (`node --test`) and `supertest` as a devDependency, but no test files exist under any directory.

**Files:**
- `package.json` (line 10)
- Entire codebase

**Why fragile:** Zero regression protection. Any change risks breaking existing functionality without detection. The authentication flow, entry CRUD, and sync logic are particularly vulnerable.

## Missing Critical Features

### No Environment Configuration Template

**Issue:** The project requires numerous environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SUPER_PASSWORD`, `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_CA_CERT`, `API_URL`, `ALLOWED_ORIGINS`, `SSL_CERT_PATH`, `SSL_KEY_PATH`, `SSL_CA_PATH`) but has no `.env.example` file documenting them.

**Files:**
- Root directory (missing `.env.example`)
- `server/` directory (missing `.env.example`)

**Problem:** Setup friction for new developers. Must reverse-engineer required env vars from source code.

**Fix approach:** Create `.env.example` with all documented variables, their purposes, and example values.

### No Data Export/Import Functionality for Local Data

**Issue:** The application stores local data in `stock-data.json` in the user data directory. There is no mechanism to export, import, or back up this data. If the file is corrupted or deleted, all local entries are lost.

**Files:**
- `src/main.js` (lines 40-58)

**Problem:** Complete data loss scenario with no recovery path.

## Test Coverage Gaps

### Entire Codebase — No Tests

**What's not tested:** Everything. Zero test files exist despite `supertest` being listed as a devDependency.

**Files:**
- All `.js` and `.html` files

**Risk:** Any change can silently break existing functionality. The authentication flow, data sync, entry validation, and PDF export have no regression protection.

**Priority:** High

### Critical Untested Paths

**What's not tested:**
1. **Authentication flow**: PIN creation, verification, TOTP setup, device trust
2. **Entry CRUD**: Save, load, delete, validation
3. **Sync logic**: Local-to-server sync, race conditions
4. **PDF report generation**: HTML template rendering, file output
5. **Database migration**: `migrate.js` path
6. **Multi-tenant isolation**: Tenant creation, data separation

**Priority:** High (all of the above)

---

*Concerns audit: 2026-07-07*
