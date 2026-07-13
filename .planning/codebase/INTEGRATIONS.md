# External Integrations

**Analysis Date:** 2026-07-07

## APIs & External Services

**Backend REST API (self-hosted):**
- **Express API Server** — Runs on configurable port (default 3000) exposed via HTTP or HTTPS
  - Base URL configured via `API_URL` env var or hardcoded in `src/config.js`
  - All stock data operations go through this API
  - Health: `GET /api/health`
  - PIN/Tenant: `POST /api/pin`, `GET /api/pin/status`, `GET /api/pin/verify`, `DELETE /api/pin`
  - Auth: `POST /api/auth/totp-verify`
  - Data: `GET /api/entries`, `POST /api/entries`, `GET /api/stock`
  - Reference: `src/server.js`, `server/index.js`

**Auto-Update:**
- **GitHub Releases** — `electron-updater` checks for updates via GitHub
  - Publisher config: `owner: "UsamaBuilds-ai"`, `repo: "stock-management"`
  - Auto-download toggle, manual install
  - Reference: `src/main.js:88-89,110-132`

**QR Code Generation:**
- **qrcode** npm package — Generates TOTP setup QR codes inline (no external API)
  - Reference: `src/server.js:325`

## Data Storage

**Databases:**
- **PostgreSQL** — Primary data store
  - Connection configured via env vars: `DB_HOST`, `DB_PORT`, `DB_NAME` (default: `stock_mgmt`), `DB_USER`, `DB_PASSWORD`
  - SSL supported via `DB_SSL=true` with optional `DB_SSL_REJECT_UNAUTHORIZED` and `DB_CA_CERT`
  - Client: `pg` (`^8.22.0`) with Pool-based connection management
  - Reference: `src/db/pool.js`

- **Multi-tenant architecture:**
  - Master database (`stock_mgmt`) holds `tenants` and `trusted_devices` tables
  - Each tenant gets a dedicated database (name pattern: `stock_t_<slug>`)
  - Tenant pools managed via `getTenantPool()` with lazy pool creation
  - Reference: `src/db/pool.js:37-48`, `src/server.js:79-86`

**Schema:**
- Master: `tenants` (tenant_id, db_name, company_name, pin_hash, totp_secret, totp_enabled, created_at)
- Master: `trusted_devices` (id, tenant_id, device_token, device_name, created_at)
- Tenant: `stock_entries` (id, date, type, item, category, quantity, rate, note, created_at)
- Tenant View: `stock_balance` (item, category, in_qty, out_qty, balance, latest_rate)
- Reference: `src/db/pool.js:76-114`

**Local Storage (Electron appData):**
- **stock-data.json** — Cached/synced stock entries (fallback when server is offline)
- **stock-pin.json** — Cached PIN hash and tenant info for local authentication
- **app-config.json** — API URL, device token, company name
- All stored in `app.getPath("userData")` (typically `%APPDATA%/stock-management/`)
- Reference: `src/main.js:16-78`

**File Storage:**
- Local filesystem only — PDF exports saved to `app.getPath("documents")`; CSV exports use Blob download

**Caching:**
- None — No Redis, Memcached, or in-memory cache layer

## Authentication & Identity

**Auth Provider:**
- **Custom PIN-based multi-tenant authentication** — No third-party auth provider (no OAuth, no SSO)
  - PIN hashed with bcrypt (10 salt rounds) on both server and local Electron side
  - Implementation:
    - Server: PIN verify via `GET /api/pin/verify` and `resolveTenant` middleware (bcrypt.compare against all tenant records)
    - Local: PIN verify via IPC handler `pin:verify` in `src/main.js`
  - Reference: `src/server.js:148-183,200-250`, `src/main.js:187-219`

**Two-Factor Authentication:**
- **TOTP via speakeasy** — Time-based one-time passwords compatible with Google Authenticator
  - TOTP secret generated during PIN setup (`POST /api/pin`)
  - QR code displayed for scanning in authenticator app
  - Device tokens issued after successful TOTP verification (`POST /api/auth/totp-verify`)
  - Trusted devices bypass TOTP on subsequent logins
  - Reference: `src/server.js:284-326,340-408`

**Authentication Headers:**
- `x-access-pin` — PIN sent as custom HTTP header for all authenticated requests
- `x-device-token` — Device trust token sent to bypass TOTP
- Reference: `src/renderer.js:453-456,453-456`

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, Rollbar, or similar service configured. All errors go to `console.error` and stdout/stderr logs.

**Logs:**
- Console-based logging with `console.log`/`console.error` throughout
- Server output files: `server_out.log`, `server_err.log` (present in repo root)
- No structured logging (no Winston, Pino, or similar)

## CI/CD & Deployment

**Hosting:**
- **Self-hosted / Oracle Cloud** — Server description in `server/package.json`: "Zestok API server for Oracle Cloud"
- HTTPS supported via Let's Encrypt certificates (env vars: `SSL_CERT_PATH`, `SSL_KEY_PATH`, `SSL_CA_PATH`)
- Reference: `server/index.js:23-53`

**CI Pipeline:**
- None detected — No GitHub Actions, GitLab CI, or other CI configuration files found

**Desktop Distribution:**
- **GitHub Releases** — `electron-updater` configured with GitHub provider
- **Windows NSIS Installer** — Built via `electron-builder --win`
- Reference: `package.json:50-54`, `build/installer.nsh`

## Environment Configuration

**Required env vars (server):**
| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5454` | PostgreSQL port |
| `DB_NAME` | `stock_mgmt` | Master database name |
| `DB_USER` | _(required)_ | PostgreSQL user |
| `DB_PASSWORD` | _(required)_ | PostgreSQL password |
| `DB_SSL` | _(not set)_ | Enable SSL connection |
| `API_PORT` | `3000` | HTTPS/HTTP server port |
| `API_HTTP_PORT` | `3001` | HTTP redirect server port |
| `DB_SUPER_PASSWORD` | _(optional)_ | Superuser for tenant DB creation |
| `ALLOWED_ORIGINS` | _(optional)_ | Additional CORS origins |
| `SSL_CERT_PATH` | _(optional)_ | HTTPS cert path |
| `SSL_KEY_PATH` | _(optional)_ | HTTPS key path |
| `SSL_CA_PATH` | _(optional)_ | HTTPS CA cert path |
| `API_URL` | _(optional)_ | Public API URL for CORS |

**Required env vars (Electron client):**
| Variable | Default | Purpose |
|----------|---------|---------|
| `API_URL` | `http://84.235.249.239:3000` | Backend server URL |

**Secrets location:**
- `.env` files in project root and `server/` directory
- `.env` is gitignored
- Runtime secrets (PIN, device tokens) stored in Electron userData dir

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected — The API does not register webhooks for external services. All external integration is request-driven (Electron client polls server; server responds to client requests).

---

*Integration audit: 2026-07-07*
