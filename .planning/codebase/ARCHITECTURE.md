<!-- refreshed: 2026-07-07 -->
# Architecture

**Analysis Date:** 2026-07-07

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                      ELECTRON DESKTOP APP                             │
│                                                                       │
│  ┌──────────────┐  preload.js   ┌──────────────────┐                 │
│  │  Renderer     │◄───bridge───►│  Main Process     │                 │
│  │  (renderer.js)│   stockApi   │  (main.js)        │                 │
│  │  + index.html │              │  - PIN mgmt       │                 │
│  │  + styles.css │              │  - JSON store R/W  │                 │
│  └──────────────┘              │  - Auto-updater    │                 │
│                                │  - PDF export      │                 │
│                                └────────┬───────────┘                 │
│                                         │                             │
│                                         │ IPC invoke                  │
│                                         ▼                             │
│                                ┌────────────────────┐                 │
│                                │  HTTP REST Client   │                 │
│                                │  (fetch to server)  │                 │
│                                └────────┬───────────┘                 │
└─────────────────────────────────────────┼─────────────────────────────┘
                                          │
                                          │ HTTPS/HTTP
                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      EXPRESS API SERVER                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  server/index.js  (entry: HTTPS/HTTP bootstrap + dotenv)    │    │
│  │  src/server.js    (Express app: routes, middleware, logic)   │    │
│  └───────────────────────────┬──────────────────────────────────┘    │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  src/db/pool.js (connection pooling, tenant DB management)   │    │
│  └────────────┬──────────────────────────────────┬──────────────┘    │
│               │                                   │                    │
│               ▼                                   ▼                    │
│  ┌────────────────────┐   ┌─────────────────────────────────┐        │
│  │  Master DB          │   │  Per-Tenant DBs                  │        │
│  │  stock_mgmt         │   │  stock_t_<company>               │        │
│  │  - tenants          │   │  - stock_entries                 │        │
│  │  - trusted_devices  │   │  - stock_balance (VIEW)          │        │
│  │  - app_settings     │   │                                  │        │
│  └────────────────────┘   └─────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────┘
                                          ▲
                                          │ Local JSON files
                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LOCAL FILESYSTEM (Electron userData)                                │
│  - stock-pin.json     (hashed PIN, tenant_id, company_name)          │
│  - stock-data.json    (all entries — offline fallback)               │
│  - app-config.json    (apiUrl, deviceToken, companyName)             │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Electron Main | Window lifecycle, IPC handlers, file I/O, auto-updater, PDF generation | `src/main.js` |
| Renderer UI | All UI rendering, tab navigation, form submission, status indicators, local state | `src/renderer.js` |
| Preload Bridge | Secure context bridge exposing IPC methods to renderer | `src/preload.js` |
| Express App | REST API endpoints, PIN/TOTP auth, tenant resolution, entry CRUD | `src/server.js` |
| Server Entry | HTTPS/HTTP server bootstrap, SSL, DB init, environment config | `server/index.js` |
| DB Connection Pool | Master + tenant-specific PostgreSQL pool management | `src/db/pool.js` |
| DB Migration | Import legacy JSON data into PostgreSQL | `src/db/migrate.js` |
| DB Schema | Reference SQL schema definitions | `src/db/schema.sql` |
| Config | API_URL export for Electron main | `src/config.js` |
| Credential Store | Sync read/write of credential config to userData | `src/credential.js` |
| Setup HTML | Cloud server setup page (server URL, company name) | `src/setup.html` |
| PIN Migration Script | One-off migration from app_settings to tenants table | `scripts/migrate-pin.js` |
| Installer NSH | NSIS custom macros for clean install/uninstall | `build/installer.nsh` |

## Pattern Overview

**Overall:** Electron Desktop App + Separate Express REST API Server

**Key Characteristics:**
- **Desktop-first with cloud sync** — app works fully offline with local JSON, syncs to server when available
- **Multi-tenant by database isolation** — each company gets a dedicated PostgreSQL database
- **PIN + TOTP authentication** — bcrypt-hashed PIN with optional TOTP 2FA via Google Authenticator
- **IPC bridge pattern** — contextIsolation: true, all main-process access through preload.js relay
- **Local-first data model** — renderer holds `state.entries[]` in memory, persists to JSON and syncs to server

## Layers

**Electron Main Process:**
- Purpose: Native OS integration, file I/O, window management, IPC handler registration
- Location: `src/main.js`
- Contains: Window creation, IPC handlers (pin:*, data:*, config:*, update:*, stock:*), auto-updater event wiring, single-instance lock
- Depends on: `electron`, `bcrypt`, `crypto`, `fs/promises`, `path`, `electron-updater`, `./config.js`
- Used by: Renderer process via preload bridge

**Renderer Process:**
- Purpose: All user interface rendering, event handling, client-side state management, server communication
- Location: `src/renderer.js`
- Contains: Tab system (dashboard/entry/report), PIN gate flow, form handling, CRUD operations, CSV/PDF export triggers, status polling, auto-update UI
- Depends on: `window.stockApi` (preload bridge), `fetch()` (to server)
- Used by: User interaction

**Preload Bridge:**
- Purpose: Secure API surface for renderer, relays IPC calls to main process
- Location: `src/preload.js`
- Contains: `contextBridge.exposeInMainWorld("stockApi", {...})` — 25+ methods bridging IPC channels
- Depends on: `electron` (contextBridge, ipcRenderer)
- Used by: `renderer.js`

**Express REST API:**
- Purpose: Server-side business logic, database operations, authentication
- Location: `src/server.js`
- Contains: Route handlers (`/api/health`, `/api/pin/*`, `/api/auth/*`, `/api/entries`, `/api/stock`), rate limiting, tenant resolution middleware, entry validation, permission repair
- Depends on: `express`, `cors`, `bcrypt`, `pg`, `speakeasy`, `qrcode`, `express-rate-limit`, `./db/pool`
- Used by: `renderer.js` (HTTP fetch), `server/index.js`

**Server Bootstrap:**
- Purpose: Environment configuration, HTTPS/HTTP server creation, master DB initialization
- Location: `server/index.js`
- Contains: dotenv loading, SSL cert loading, HTTP redirect (port 3001), HTTPS server (port 3000), fallback to HTTP, ensures master DB exists
- Depends on: `dotenv`, `https`, `http`, `fs`, `../src/server`, `../src/db/pool`
- Used by: Server startup (`node server/index.js`)

**Database Layer:**
- Purpose: Connection pooling, tenant database lifecycle, schema management
- Location: `src/db/pool.js`
- Contains: `masterPool` (3 conns), `getTenantPool()` (2 conns per tenant), `ensureMasterDb()` (creates stock_mgmt DB + tenants + trusted_devices tables)
- Depends on: `pg`
- Used by: `src/server.js`, `src/db/migrate.js`

## Data Flow

### Primary Request Path — Stock Entry Submission

1. User fills form and clicks "Save Entry" in renderer (`renderer.js:665`)
2. `handleSubmit()` creates entry object with UUID, pushes to `state.entries[]` (`renderer.js:684`)
3. `save()` is called (`renderer.js:466`):
   - Calls `window.stockApi.saveDataLocal(entries)` — IPC to main process (`renderer.js:467`)
   - Main process writes `stock-data.json` via `dataStore.write()` (`main.js:225-228`)
   - Sets `_dirty = true` (`renderer.js:468`)
   - Calls `syncToServer()` — HTTP POST to `/api/entries` (`renderer.js:469`)
4. Server receives POST, `resolveTenant` middleware verifies PIN via bcrypt (`server.js:148-183`)
5. `saveEntries()` validates entries, begins transaction, deletes all + re-inserts (`server.js:467-508`)
6. Returns success response (`server.js:500`)
7. Renderer re-renders current tab (`renderer.js:689`)

### PIN Authentication Flow — Login

1. User enters PIN in `#loginPin` input (`renderer.js:301`)
2. `handlePinLogin()` fetches config, gets device token (`renderer.js:308-309`)
3. Calls `/api/pin/verify` with `x-access-pin` and `x-device-token` headers (`renderer.js:316`)
4. Server iterates tenants, bcrypt-compares PIN against all `pin_hash` values (`server.js:210-214`)
5. If match: checks TOTP requirement (enabled + no trusted device token) (`server.js:236-243`)
6. If TOTP required: returns `{ valid: true, totpRequired: true }` -> renderer shows TOTP form (`renderer.js:321-328`)
7. On TOTP success: `showTotpForm()` calls `/api/auth/totp-verify`, gets `deviceToken` (`renderer.js:158-179`)
8. On success: saves PIN locally via `window.stockApi.savePinLocal()`, calls `unlockApp()` (`renderer.js:325-326`)
9. If server unreachable: falls back to local PIN verification via `window.stockApi.verifyPin()` (`renderer.js:337-338`)

### Auto-Updater Flow

1. Renderer calls `window.stockApi.checkForUpdates()` in `setupUpdater()` (`renderer.js:858`)
2. Main process IPC handler calls `autoUpdater.checkForUpdates()` (`main.js:157`)
3. `electron-updater` events are forwarded to renderer via IPC (`main.js:110-132`)
4. Renderer UI shows banner with download/install actions (`renderer.js:798-859`)

**State Management:**
- In-memory: `state` object in `renderer.js:16-19` holds `entries[]`, `activeTab`, `companyName`
- Persistent local: JSON files in Electron's `userData` path (`stock-data.json`, `stock-pin.json`, `app-config.json`)
- Cloud: PostgreSQL databases (master: `stock_mgmt`, per-tenant: `stock_t_<company>`)
- Sync direction: local-first — changes saved locally first, synced to server asynchronously

## Key Abstractions

**PIN Authentication:**
- Purpose: Secure entry to the application using numeric PIN + optional TOTP
- Files: `src/renderer.js` (showPinGate, handlePinSetup, handlePinLogin, showTotpForm, showTotpSetup), `src/server.js` (POST /api/pin, GET /api/pin/verify, POST /api/auth/totp-verify), `src/main.js` (pin:* IPC handlers)
- Pattern: bcrypt hash stored locally and on server, speakeasy TOTP for 2FA, per-tenant database isolation

**Data Store Factory:**
- Purpose: JSON file read/write abstraction for local persistence
- Files: `src/main.js` (lines 20-78: `createPinStore()`, `createDataFile()`, `createConfigStore()`)
- Pattern: Factory functions returning `{ read, write }` objects, scoped to specific JSON files in `app.getPath("userData")`

**Multi-Tenant Database Resolution:**
- Purpose: Isolate each company's stock data into separate PostgreSQL databases
- Files: `src/server.js` (`resolveTenant` middleware line 148, `getTenantPool()`, `slugifyDbName()`, `resolveTenantDbName()`)
- Files: `src/db/pool.js` (`masterPool`, `getTenantPool()`, `tenantPools` cache map)
- Pattern: Master DB holds tenant registry (id, db_name, pin_hash, totp_secret), per-tenant DBs hold stock data, pools cached by db_name

**Stock Entry Domain:**
- Purpose: Core business object representing a stock in/out transaction
- Fields: `id` (UUID), `date`, `type` (in|out), `item`, `category`, `quantity`, `rate`, `note`, `createdAt`
- Validation: `validateEntry()` in `server.js:457-465` — checks id, date, type, item range, quantity > 0, rate >= 0
- Aggregation view: `stock_balance` VIEW in `server.js:101-113` — computes in_qty, out_qty, balance, latest_rate per item

## Entry Points

**Desktop App:**
- Location: `src/main.js`
- Triggers: Electron startup (`electron .` from npm start)
- Responsibilities: Single-instance lock, window creation (1220x820), load `index.html`, register all IPC handlers, initialize auto-updater, manage app lifecycle

**Server Entry:**
- Location: `server/index.js`
- Triggers: `node server/index.js` or `npm run server`
- Responsibilities: Load dotenv, ensure master DB exists, create HTTPS server (port 3000) with optional SSL, HTTP redirect server (port 3001), or fallback plain HTTP

**Setup Page:**
- Location: `src/setup.html`
- Triggers: Manual navigation by user
- Responsibilities: Gather server URL and company name, validate server connectivity via `/api/health`, persist to `localStorage`, redirect to `index.html`

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. Electron main process and Express server both run on the main thread. No worker threads used.
- **Global state:** Module-level singletons exist:
  - `masterPool` in `src/db/pool.js:23` — singleton connection pool for master DB
  - `tenantPools` in `src/db/pool.js:35` — module-scoped cache of tenant pools (mutable map)
  - `mainWindow` in `src/main.js:83` — single BrowserWindow reference
  - Various module-level vars in `src/renderer.js` (`API`, `_currentPin`, `_deviceToken`, `_unlock`, `_dirty`, etc.)
  - `state` object in `src/renderer.js:16-19` — full application state in a mutable global
- **Circular imports:** Not detected. Dependency chain is linear: `renderer.js` (renderer) → `preload.js` (bridge) → `main.js` (main) || `src/server.js` (API) → `src/db/pool.js` (DB). `server/index.js` imports both `src/server.js` and `src/db/pool.js`.
- **Single instance lock:** `app.requestSingleInstanceLock()` in `main.js:85` — only one app instance allowed, second instance focuses the existing window.

## Anti-Patterns

### Global Mutable State Factory

**What happens:** `createDataFile()`, `createPinStore()`, and `createConfigStore()` in `main.js:20-78` are factories creating `{ read, write }` objects. They are assigned to module-scoped variables (`pinStore`, `dataStore`, `configStore`) on app ready.

**Why it's wrong:** The factory functions capture `filePath` at creation time but the stores are only initialized in `app.whenReady()`. Any IPC handler that fires before initialization would throw (though unlikely in practice).

**Do this instead:** Initialize immediately at module level or use a lazy initialization pattern. See `main.js` where the pattern is consistent.

### Full Replace Sync Strategy

**What happens:** `saveEntries()` in `server.js:467-508` runs `DELETE FROM stock_entries` then re-inserts ALL entries in a transaction. This is done on every save.

**Why it's wrong:** For large datasets, this is O(n) for every write. It loses created_at timestamps on re-insert. It also creates a window where data is missing if the transaction fails mid-way (though rollback handles partial failures).

**Do this instead:** Use UPSERT-only approach incrementally — insert new, update changed, delete removed. The existing code uses `ON CONFLICT (id) DO UPDATE` on each row but still deletes all first.

### Inline PDF Generation in Main Process

**What happens:** `stock:export-report-pdf` handler in `main.js:238-341` contains full HTML template string and styling inline within the IPC handler.

**Why it's wrong:** 100+ lines of HTML/CSS template mixed with business logic in an IPC handler. Template is tightly coupled to the handler and cannot be reused or tested independently.

**Do this instead:** Extract HTML template to a separate file or module, keep the IPC handler thin.

## Error Handling

**Strategy:** Hybrid — try server first, fall back to local storage.

**Patterns:**
- Server calls: try fetch → catch → fall back to local IPC (`renderer.js:869-883`)
- Database: try query → catch permission denied → attempt permission repair → retry (`server.js:440-451`)
- Global uncaught exception handler in main process: log and quit (`main.js:5-9`)
- Unhandled rejection handler in renderer: prevent default, log (`renderer.js:11-14`)
- Rate limiting: express-rate-limit on PIN verify (10/15min), PIN create (5/hour), global auth (20/15min) (`server.js:124-146`)

## Cross-Cutting Concerns

**Logging:** Plain `console.log`/`console.error` throughout. No structured logging library. Server logs to stdout/stderr, which are captured in `server_out.log` and `server_err.log` at project root.

**Validation:**
- Client-side: basic form validation in `handleSubmit()` (`renderer.js:680`) — item, category, note, quantity, rate checks
- Server-side: `validateEntry()` function validates id, date, type, item length, quantity > 0, rate >= 0 (`server.js:457-465`)
- PIN length: min 4, max 72 characters checked on both client and server

**Authentication:**
- PIN-based with bcrypt hashing (cost factor 10)
- Optional TOTP 2FA via speakeasy (window: 2)
- Device trust tokens (32-byte random hex) stored in `trusted_devices` table
- PIN passed via `x-access-pin` header, device token via `x-device-token` header

---

*Architecture analysis: 2026-07-07*
