# Phase 2: Desktop PostgreSQL Integration + PIN Management - Research

**Researched:** 2026-06-24
**Domain:** Electron main process ↔ PostgreSQL integration, Express lifecycle management, PIN management UI
**Confidence:** HIGH

## Summary

Phase 2 migrates the Electron desktop app from JSON file storage to PostgreSQL as the primary data source, adds a PIN settings modal (set/change PIN with bcrypt hashing), displays local IP for mobile connectivity, integrates the Express server lifecycle with Electron's app events, and implements auto-export to JSON on exit as a read-only fallback.

The primary technical challenge is **refactoring `src/main.js`** — the existing `createStore` factory reads/writes JSON, and all IPC handlers (`stock:load`, `stock:save`) route through it. These handlers must be augmented to use `pg.Pool` queries while keeping the JSON store as a fallback and auto-export mechanism. The second challenge is **Express lifecycle integration**: `src/server.js` currently calls `app.listen()` at require-time (line 34), which must change to an exported `startServer()`/`stopServer()` interface called from `main.js`.

**Primary recommendation:** Create a `src/db.js` module that exports a pre-configured `pg.Pool`, add new IPC channels for PIN operations and PG queries, refactor `server.js` to export lifecycle functions, and add a modal overlay in `index.html` for PIN settings. Use only built-in Node.js `os.networkInterfaces()` for local IP detection (no extra dependencies).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Desktop main process connects to PostgreSQL directly via `pg` package (not through Express API)
- **D-02:** Desktop reads database config from same `.env` file as Express — shared configuration
- **D-03:** Verify PostgreSQL connectivity on app startup — show error dialog and block usage if unreachable
- **D-04:** When PostgreSQL is down, display "Database unavailable" error and prevent data entry until connection restored
- **D-05:** PIN settings appear as a modal/dialog opened from a gear icon or settings button — not a new tab
- **D-06:** Form fields: If no PIN exists → "Set PIN" + "Confirm PIN". If PIN exists → "Current PIN" + "New PIN" + "Confirm New PIN"
- **D-07:** Local IP address for mobile connection displayed on the same PIN settings dialog
- **D-08:** PIN must be 4-6 numeric digits only
- **D-09:** Express server starts in Electron's main process on app `ready` event — before window opens
- **D-10:** Server gracefully closes on `before-quit` or `will-quit` event — clean port release
- **D-11:** If port 3000 is in use: show dialog with options (Retry / Use alternative port / Cancel). Chosen port displayed in status indicator
- **D-12:** Server status indicator (Running/Stopped) shown in app footer
- **D-13:** PostgreSQL is the source of truth — desktop reads/writes PG for all operations
- **D-14:** JSON file (`stock-data.json`) kept as read-only fallback — loaded only when PostgreSQL is unreachable
- **D-15:** Auto-export current data to JSON on app exit — creates/updates backup file for next session fallback

### the agent's Discretion

None — all areas have locked decisions.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DKT-01 | Desktop reads stock data from PostgreSQL instead of JSON | `pg.Pool` query replaces `createStore().read()` — see IPC pattern in Architecture Patterns |
| DKT-02 | Desktop writes stock entries to PostgreSQL | `pg.Pool` INSERT replaces `createStore().write()` — save handler chain: UPSERT to PG, then async write to JSON |
| DKT-03 | Desktop PIN settings page (set/change access PIN) | Modal overlay + IPC `pin:*` channels + bcryptjs hashing in main process |
| DKT-04 | Desktop displays local IP address for mobile connection | `os.networkInterfaces()` built-in — no external dependency needed |
| DKT-05 | Express server auto-starts with desktop app | Refactor `server.js` to export `startServer()`/`stopServer()` — call from `app.whenReady()` / `app.on('will-quit')` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PG connection (pool) | Main Process | — | `pg` lib requires Node.js — cannot run in renderer (contextIsolation: true) |
| PG read queries | Main Process | — | IPC handler pattern: renderer invokes via `stockApi.load()`, main executes `pool.query()` |
| PG write queries (INSERT) | Main Process | — | Same IPC pattern — `stockApi.save()` invokes main process handler |
| PIN hashing & verification | Main Process | — | bcryptjs requires Node.js crypto — must run in main process |
| PIN settings modal UI | Renderer | Main Process | Modal is HTML/CSS overlay in renderer; IPC calls to main for bcrypt ops |
| Local IP detection | Main Process | — | `os.networkInterfaces()` is a Node.js API — sent to renderer via IPC |
| Express server lifecycle | Main Process | — | Express runs in same process as Electron main — lifecycle tied to app events |
| Port conflict dialog | Main Process | — | Electron `dialog` module is main-process only |
| Server status indicator | Renderer | Main Process | Footer UI in renderer; status pushed from main via IPC (send, not invoke) |
| JSON auto-export | Main Process | — | `fs.writeFile` requires Node.js in main process |
| PG connectivity check | Main Process | — | Runs at startup in main process before window creation |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg | 8.22.0 | PostgreSQL client for Node.js | De facto standard — 34M weekly downloads, maintained by brianc (node-postgres). Built-in connection pooling via `pg.Pool`. Supports libpq env vars natively. |
| dotenv | 17.4.2 | Load .env file | Zero-dependency, 147M weekly downloads. Standard for Node.js env management. |
| bcryptjs | 3.0.3 | PIN hashing | Zero-dependency bcrypt implementation. Compatible with `bcrypt` API. Used for PIN storage in Phase 1. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express-rate-limit | 8.5.2 | API rate limiting | Phase 1 requirement (API-04 / D-08) — not Phase 2 scope but must be present |

### Already Installed (No Change Needed)
| Library | Version | Purpose |
|---------|---------|---------|
| express | 5.2.1 | HTTP API server for mobile access |
| cors | 2.8.6 | CORS middleware for Express |
| electron | 31.7.7 | Desktop application framework |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pg` (node-postgres) | `pg-promise`, `knex`, `prisma` | `pg` is the lowest-level option — no ORM overhead, direct SQL control. Best fit for a simple schema with direct queries. |
| `bcryptjs` | `bcrypt` (native) | `bcryptjs` is pure JS with zero native dependencies, avoids node-gyp issues on Windows. Same API. |
| dotenv | Hardcode config in code | `.env` is standard for 12-factor apps, shared between Express and desktop processes. |

**Installation:**
```bash
npm install pg dotenv bcryptjs
```

**Version verification (run before plan):**
```bash
npm view pg version          # 8.22.0
npm view dotenv version      # 17.4.2
npm view bcryptjs version    # 3.0.3
```

### .env Variable Convention

node-postgres natively supports libpq environment variables:
- `PGHOST` — hostname (default: localhost)
- `PGPORT` — port (default: 5432)
- `PGDATABASE` — database name
- `PGUSER` — user
- `PGPASSWORD` — password

Using these standard names means `new Pool()` auto-picks them up from the environment without any mapping code. This is the **recommended approach** for Phase 2 since Phase 1's `.env` file naming should use these exact keys for seamless integration. The `.env` file must exist at the project root (same directory as `package.json`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pg | npm | 13+ years (latest: 5 days ago) | 34.3M/wk | github.com/brianc/node-postgres | [SUS] | Flagged — likely false positive (recent patch publish) |
| dotenv | npm | 11+ years | 147M/wk | github.com/motdotla/dotenv | [OK] | Approved |
| bcryptjs | npm | 10+ years | 11.6M/wk | github.com/dcodeIO/bcrypt.js | [OK] | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:**
- `pg` — Flagged only due to "too-new" publish date (2026-06-19). All other signals are strong: 34M weekly downloads, maintainer `brianc` (Brian Carlson, original node-postgres author), repo `github.com/brianc/node-postgres`, no postinstall script, no deprecation. Planner must add `checkpoint:human-verify` before installing `pg`.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron Application                        │
│                                                                  │
│  ┌─────────────────────────────────┐                             │
│  │        Main Process             │                             │
│  │        (src/main.js)            │                             │
│  │                                 │                             │
│  │  ┌─────────────────────────┐    │    IPC contextBridge        │
│  │  │     App Lifecycle        │    │  ┌──────────────────┐      │
│  │  │  ┌───────────────────┐   │    │  │   Renderer       │      │
│  │  │  │ app.whenReady()  │   │    │  │  (src/renderer)  │      │
│  │  │  │ 1. dotenv.config │   │    │  │                  │      │
│  │  │  │ 2. pgPool.query()│   │    │  │  Dashboard Tab   │      │
│  │  │  │    (verify conn) │   │    │  │  Entry Tab       │      │
│  │  │  │ 3. startServer() │   │    │  │  Report Tab      │      │
│  │  │  │ 4. createWindow()│   │    │  │  ⚙ PIN Modal     │      │
│  │  │  └───────────────────┘   │    │  │                  │      │
│  │  │                          │    │  │  Footer:         │      │
│  │  │  ┌───────────────────┐   │    │  │  • Server: 🟢    │      │
│  │  │  │ app.on('will-quit')│   │    │  │  • IP: 192.168.x │      │
│  │  │  │ 1. stopServer()   │   │    │  └──────────────────┘      │
│  │  │  │ 2. autoExport()   │   │    │                             │
│  │  │  │ 3. pool.end()     │   │    │                             │
│  │  │  └───────────────────┘   │    │                             │
│  │  │                          │    │                             │
│  │  │  ┌───────────────────┐   │    │                             │
│  │  │  │  IPC Handlers     │   │    │                             │
│  │  │  │  stock:load  ──► PG│   │    │                             │
│  │  │  │  stock:save  ──► PG│   │    │                             │
│  │  │  │               └─► JS│   │    │                             │
│  │  │  │  pin:*       ──► PG│   │    │                             │
│  │  │  │  ip:address ──► os │   │    │                             │
│  │  │  └───────────────────┘   │    │                             │
│  │  │                          │    │                             │
│  │  │  ┌───────────────────┐   │    │                             │
│  │  │  │  Express Server   │   │    │                             │
│  │  │  │  (src/server.js)  │   │    │                             │
│  │  │  │  Port 3000        │◄──┼────┼───── Mobile APK (Phase 3)   │
│  │  │  │  /api/stock       │   │    │                             │
│  │  │  │  /api/pin/verify  │   │    │                             │
│  │  │  │  /api/pin/status  │   │    │                             │
│  │  │  └───────────────────┘   │    │                             │
│  │  │                          │    │                             │
│  │  │  ┌───────────────────┐   │    │                             │
│  │  │  │  Store (JSON)     │   │    │                             │
│  │  │  │  createStore()    │   │    │                             │
│  │  │  │  Read fallback    │   │    │                             │
│  │  │  │  Auto-export      │   │    │                             │
│  │  │  └───────────────────┘   │    │                             │
│  │  └─────────────────────────┘    │                             │
│  └─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   PostgreSQL 16+   │
                    │   stock_db DB      │
                    │   stock_entries    │
                    │   app_settings     │
                    └───────────────────┘
```

### Recommended Project Structure

```
src/
├── main.js          # Electron main process — refactored for PG + Express lifecycle
├── renderer.js      # UI logic — add PIN modal, IP display, server status
├── preload.js       # IPC bridge — add new channels (pin:*, get:local-ip, get:server-status)
├── server.js        # Express API — refactored to export start/stop functions
├── db.js            # NEW — PostgreSQL pool module (shared between main.js and server.js)
├── index.html       # SPA structure — add PIN modal HTML, server status footer
└── styles.css       # Styling — modal overlay styles, status indicator
```

### Pattern 1: Database Connection Pool Module
**What:** A shared `pg.Pool` instance that both `main.js` (desktop) and `server.js` (Express) use. Loads config from `.env` via dotenv.
**When to use:** Every phase that connects to PostgreSQL. Single pool, shared across the main process.
**Example:**
```javascript
// src/db.js
const { Pool } = require('pg');

// dotenv should be loaded before requiring this module
const pool = new Pool({
  max: 5,                          // Desktop app — low concurrency
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,   // Fail fast if PG is down
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});

module.exports = { pool };
```
**Note:** Using libpq standard env vars (`PGHOST`, `PGPORT`, etc.) means `new Pool()` auto-reads them — no explicit mapping needed. [CITED: node-postgres.com/features/connecting]

### Pattern 2: IPC Handler for PG Operations
**What:** Existing `stock:load`/`stock:save` IPC handlers augmented to query PostgreSQL while keeping JSON store for fallback and auto-export.
**When to use:** All data operations from renderer to main process.
**Example:**
```javascript
// src/main.js — refactored stock:load handler
ipcMain.handle("stock:load", async () => {
  try {
    const result = await pool.query('SELECT * FROM stock_entries ORDER BY created_at DESC');
    return { entries: result.rows };
  } catch (err) {
    console.error("PG query failed, falling back to JSON:", err.message);
    return await store.read(); // JSON fallback
  }
});

ipcMain.handle("stock:save", async (_event, payload) => {
  const entry = payload.entry || payload; // handle both shapes
  try {
    await pool.query(
      `INSERT INTO stock_entries (id, date, type, item, category, quantity, rate, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET ...`,
      [entry.id, entry.date, entry.type, entry.item, entry.category,
       entry.quantity, entry.rate, entry.note, entry.createdAt]
    );
  } catch (err) {
    console.error("PG insert failed:", err.message);
  }
  // Always write JSON backup
  await store.write(payload);
  return payload;
});
```

### Pattern 3: PIN Operations via IPC
**What:** New IPC channels for PIN status, set, change, and verify. bcryptjs hashing in main process.
**When to use:** PIN management modal interactions.
**Example:**
```javascript
// src/main.js
const bcrypt = require('bcryptjs');

ipcMain.handle("pin:status", async () => {
  const result = await pool.query("SELECT value FROM app_settings WHERE key = 'pin_hash'");
  return { configured: result.rows.length > 0 };
});

ipcMain.handle("pin:set", async (_event, { pin }) => {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4-6 digits");
  const hash = bcrypt.hashSync(pin, 10);
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('pin_hash', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [hash]
  );
  return { success: true };
});

ipcMain.handle("pin:change", async (_event, { currentPin, newPin }) => {
  const result = await pool.query("SELECT value FROM app_settings WHERE key = 'pin_hash'");
  if (result.rows.length === 0) throw new Error("No PIN configured");
  if (!bcrypt.compareSync(currentPin, result.rows[0].value)) {
    throw new Error("Current PIN is incorrect");
  }
  if (!/^\d{4,6}$/.test(newPin)) throw new Error("New PIN must be 4-6 digits");
  const hash = bcrypt.hashSync(newPin, 10);
  await pool.query("UPDATE app_settings SET value = $1 WHERE key = 'pin_hash'", [hash]);
  return { success: true };
});
```

### Pattern 4: Express Server Lifecycle Integration
**What:** Server.js exports `startServer()` and `stopServer()` instead of auto-starting at require-time. Main.js controls lifecycle.
**When to use:** Express server that must start/stop with Electron app lifecycle.
**Example:**
```javascript
// src/server.js — refactored
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

let server = null;

async function startServer(port = 3000) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Graceful shutdown wrapper
  app.get('/api/stock', async (req, res) => { /* queries pool */ });

  return new Promise((resolve, reject) => {
    server = app.listen(port, '0.0.0.0', () => {
      console.log(`Express server running on port ${port}`);
      resolve(port);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') reject(err);
      else reject(err);
    });
  });
}

async function stopServer() {
  if (!server) return;
  return new Promise((resolve) => {
    server.close(() => {
      console.log("Express server closed");
      server = null;
      resolve();
    });
  });
}

module.exports = { startServer, stopServer };
```

```javascript
// src/main.js — lifecycle integration
const { startServer, stopServer } = require('./server');
const { pool } = require('./db');

app.whenReady().then(async () => {
  // 1. Load .env
  require('dotenv').config();

  // 2. Verify PG connectivity
  try {
    await pool.query('SELECT 1');
    console.log("PostgreSQL connection OK");
  } catch (err) {
    dialog.showErrorBox("Database Unavailable",
      "Could not connect to PostgreSQL.\n\n" +
      "Please ensure PostgreSQL is running and the .env file is configured correctly.\n\n" +
      "The app will start in read-only mode using cached JSON data.");
  }

  // 3. Start Express server (with port conflict handling)
  store = await createStore();
  await startExpressWithRetry();

  // 4. Create window
  createWindow();
});

app.on('will-quit', async (event) => {
  event.preventDefault();
  // 1. Stop Express server
  await stopServer();
  // 2. Auto-export to JSON
  try {
    const result = await pool.query('SELECT * FROM stock_entries ORDER BY created_at DESC');
    await store.write({ entries: result.rows });
  } catch (err) {
    console.error("Auto-export failed:", err.message);
  }
  // 3. Close pool
  await pool.end();
});
```

### Pattern 5: Port Conflict Dialog
**What:** Detect EADDRINUSE, show Electron dialog with Retry/Alternative/Cancel.
**When to use:** When Express server cannot bind to port 3000.
**Example:**
```javascript
// src/main.js — port conflict handling
const { dialog } = require('electron');

async function startExpressWithRetry() {
  const PORT = parseInt(process.env.PORT, 10) || 3000;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const actualPort = await startServer(PORT);
      // Send port to renderer for display
      mainWindow.webContents.send('server:status', { running: true, port: actualPort });
      return;
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'Port In Use',
          message: `Port ${PORT} is already in use by another application.`,
          detail: `The Express server cannot start on port ${PORT}. What would you like to do?`,
          buttons: ['Retry', 'Use Alternative Port', 'Cancel'],
          defaultId: 0,
          cancelId: 2,
        });
        if (result.response === 1) {
          // Use alternative port — find next available
          const altPort = await findAvailablePort(PORT + 1);
          return await startExpressWithAltPort(altPort);
        } else if (result.response === 2) {
          return; // Cancel — run without Express
        }
        // else: Retry — loop continues
        await new Promise(r => setTimeout(r, 1000));
      } else {
        throw err; // Non-port error
      }
    }
  }
  console.error("Failed to start Express after 3 retries");
}
```

### Pattern 6: Local IP Detection
**What:** Use `os.networkInterfaces()` to find the primary non-internal IPv4 address.
**When to use:** Displaying local IP for mobile connection in PIN settings dialog.
**Example:**
```javascript
// src/main.js
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address; // First non-internal IPv4 found
      }
    }
  }
  return '127.0.0.1'; // fallback
}

ipcMain.handle("get:local-ip", () => getLocalIP());
```
No external dependency needed — `os` is a built-in Node.js module. [VERIFIED: npm registry (built-in)]

### Anti-Patterns to Avoid

- **Starting Express at require-time:** Current `server.js` does `app.listen()` at module scope. This prevents lifecycle control. Always export `startServer()`/`stopServer()`.
- **Blocking app ready with startup tasks:** PG verification and Express startup should be async but sequential. Use `await` in `app.whenReady().then(async () => { ... })`.
- **Storing PIN in-memory only:** Always hash with bcrypt before persisting. Phase 1 established bcrypt hashing (D-06).
- **Using `before-quit` for async cleanup on Windows:** On Windows shutdown, `before-quit` may not fire reliably. Use `will-quit` instead. Per Electron docs, `will-quit` is emitted after `before-quit` and is the last chance to perform cleanup. [CITED: electronjs.org/docs/latest/api/app]
- **Hardcoding PIN validation in renderer:** PIN validation (4-6 digits) must be validated in BOTH renderer (UX feedback) and main process (security boundary — never trust renderer).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PostgreSQL connection | Raw `net.Socket` or manual connection management | `pg.Pool` | Handles connection lifecycle, pooling, error recovery, timeout. 13 years of production use. |
| PIN hashing | Custom hash function or MD5/SHA | `bcryptjs` | Bcrypt is designed for credential hashing — includes salt, configurable work factor, resistant to brute force. Never hand-roll auth hashing. |
| Port conflict detection | Custom TCP probe | Express `server.on('error')` + `net.createServer()` | Express emits `EADDRINUSE` on the server's error event. Use `net.createServer()` for proactive detection before `app.listen()`. |
| Local IP detection | Platform-specific netstat parsing | `os.networkInterfaces()` | Built-in Node.js API, cross-platform (Win/Mac/Linux), no dependencies. |

**Key insight:** Phase 2 has a low dependency surface — `pg`, `dotenv`, `bcryptjs` are the only new packages. Everything else (local IP, modal UI, port detection) uses built-in Node.js/Electron APIs or plain HTML/CSS/JS. This keeps the build lean and avoids dependency risk.

## Common Pitfalls

### Pitfall 1: Express EADDRINUSE causes silent crash
**What goes wrong:** When port 3000 is in use, `app.listen()` throws an unhandled `'error'` event, crashing the Electron app without user feedback.
**Why it happens:** Express emits `'error'` on the returned server object, not as a thrown exception. Without a `server.on('error')` handler, it becomes an unhandled error.
**How to avoid:** Always attach `server.on('error', handler)` immediately after `server = app.listen(...)`. Wrap in a Promise for clean async/await usage.
**Warning signs:** App window opens but Express doesn't start; mobile users get connection refused.

### Pitfall 2: `before-quit` not firing on Windows shutdown
**What goes wrong:** JSON auto-export doesn't run when Windows shuts down or user logs off.
**Why it happens:** Electron's `before-quit` event is not guaranteed on Windows session end. The `will-quit` event fires in more scenarios, and `app.on('window-all-closed')` also fires.
**How to avoid:** Register cleanup in `app.on('will-quit')` instead of (or in addition to) `before-quit`. On Windows, also listen to `app.on('session-end')` for immediate shutdown scenarios. Use synchronous `writeFileSync` for the auto-export to ensure it completes before process exits. [CITED: github.com/electron/electron/issues/9433]
**Warning signs:** `stock-data.json` not updated after app close on Windows restart/logoff.

### Pitfall 3: pg connects but pool doesn't work after PG restart
**What goes wrong:** If PostgreSQL restarts while the app is running, the pool's existing connections become stale. Next query hangs or throws.
**Why it happens:** `pg.Pool` has built-in `idleTimeoutMillis` for idle client eviction, but an active connection being used when PG goes down will throw.
**How to avoid:** Set `connectionTimeoutMillis: 2000` to fail fast. Add `pool.on('error', ...)` handler. Consider a health check IPC endpoint that runs `pool.query('SELECT 1')` and returns status to the renderer for UI feedback.
**Warning signs:** App freezes on next save/load after PG restart.

### Pitfall 4: Renderer stores PIN state insecurely
**What goes wrong:** PIN values stored in `state` object in renderer could be inspected via DevTools.
**Why it happens:** Electron allows DevTools access. Any PIN value held in renderer memory is visible to anyone with DevTools open.
**How to avoid:** Never store PIN hash or plaintext in renderer state. IPC calls to main process handle all PIN operations. The renderer only holds form field values temporarily during input. Clear field values after submit/close.
**Warning signs:** N/A — preventive design pattern.

### Pitfall 5: Error dialog blocks app startup indefinitely
**What goes wrong:** If PG is unreachable, `dialog.showErrorBox()` blocks the main process, then the app proceeds without data.
**Why it happens:** `dialog.showErrorBox()` is synchronous and modal — it blocks the event loop. The dialog informs the user but offers no action.
**How to avoid:** Use `dialog.showMessageBox()` with a "Continue anyway" / "Retry" / "Quit" choice. Track PG availability in a global `isPGConnected` flag. IPC load handlers check this flag and fall back to JSON when false. Show a persistent "Database unavailable" banner in the UI.
**Warning signs:** Startup hangs on dialog; user forced to kill the app process.

## Code Examples

### Example 1: Express lifecycle refactoring — exporting start/stop
```javascript
// src/server.js — full refactored pattern
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

let server = null;

async function startServer(port = 3000) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- Stock API ---
  app.get('/api/stock', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT item, category, 
               SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) AS in_qty,
               SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) AS out_qty,
               SUM(CASE WHEN type = 'in' THEN quantity WHEN type = 'out' THEN -quantity ELSE 0 END) AS balance
        FROM stock_entries
        GROUP BY item, category
        HAVING SUM(CASE WHEN type = 'in' THEN quantity WHEN type = 'out' THEN -quantity ELSE 0 END) > 0
        ORDER BY item
      `);
      res.json(result.rows);
    } catch (err) {
      res.status(503).json({ error: 'database_unreachable', message: 'Database is not available' });
    }
  });

  // --- PIN status ---
  app.get('/api/pin/status', async (req, res) => {
    try {
      const result = await pool.query("SELECT value FROM app_settings WHERE key = 'pin_hash'");
      res.json({ configured: result.rows.length > 0 });
    } catch (err) {
      res.status(503).json({ error: 'database_unreachable' });
    }
  });

  return new Promise((resolve, reject) => {
    server = app.listen(port, '0.0.0.0', () => resolve(port));
    server.on('error', reject);
  });
}

async function stopServer() {
  if (!server) return;
  return new Promise((resolve) => {
    server.close(() => { server = null; resolve(); });
  });
}

module.exports = { startServer, stopServer };
```
Source: Adapted from Express v5 API docs. [CITED: expressjs.com/en/5x/api.html]

### Example 2: Modal overlay HTML pattern
```html
<!-- src/index.html — PIN settings modal -->
<div id="pinModal" class="modal-overlay" style="display:none;">
  <div class="modal-dialog">
    <div class="modal-header">
      <h2>⚙ Settings</h2>
      <button id="pinModalClose" class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div id="ipSection" class="ip-display">
        <span>Local Network IP:</span>
        <strong id="localIp">Detecting...</strong>
      </div>
      <hr />
      <form id="pinForm">
        <div id="setPinFields">
          <label>Set PIN (4-6 digits)</label>
          <input id="newPin" type="password" maxlength="6" inputmode="numeric" pattern="\d{4,6}" />
          <label>Confirm PIN</label>
          <input id="confirmPin" type="password" maxlength="6" inputmode="numeric" pattern="\d{4,6}" />
        </div>
        <div id="changePinFields" style="display:none;">
          <label>Current PIN</label>
          <input id="currentPin" type="password" maxlength="6" inputmode="numeric" />
          <label>New PIN (4-6 digits)</label>
          <input id="newPinChange" type="password" maxlength="6" inputmode="numeric" pattern="\d{4,6}" />
          <label>Confirm New PIN</label>
          <input id="confirmNewPin" type="password" maxlength="6" inputmode="numeric" pattern="\d{4,6}" />
        </div>
        <div class="modal-actions">
          <button type="submit" class="primary-btn">Save</button>
          <button type="button" class="secondary-btn" id="pinModalCancel">Cancel</button>
        </div>
      </form>
      <p id="pinError" class="error-message" style="color:var(--bad); display:none;"></p>
    </div>
  </div>
</div>
```
Source: Standard HTML overlay modal pattern. No external library required.

### Example 3: Modal CSS
```css
/* src/styles.css — modal overlay styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: var(--panel);
  border-radius: 10px;
  box-shadow: 0 22px 50px rgba(3, 18, 45, 0.4);
  width: 420px;
  max-width: 90vw;
  padding: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: #122946;
}

.modal-close {
  border: 0;
  background: transparent;
  font-size: 28px;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  line-height: 1;
}

.ip-display {
  padding: 12px;
  background: #eaf3ff;
  border-radius: 6px;
  margin-bottom: 16px;
}

.ip-display span {
  font-size: 13px;
  color: var(--muted);
  font-weight: 700;
  display: block;
}

.ip-display strong {
  font-size: 18px;
  color: var(--brand-dark);
  display: block;
  margin-top: 4px;
  font-family: 'Consolas', 'Courier New', monospace;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
```

### Example 4: Server status footer
```html
<!-- src/index.html — refactored footer -->
<footer>
  <div class="footer-left">
    <span>Build by Usama</span>
    <span class="server-status" id="serverStatus">
      <span class="status-dot offline" id="statusDot"></span>
      <span id="statusText">Server: Starting...</span>
    </span>
  </div>
  <div class="footer-right">
    <button id="settingsBtn" class="gear-btn" title="Settings">⚙</button>
    <span>For Any Query Contact # 0314-2958627</span>
  </div>
</footer>
```

## Runtime State Inventory

> This section is omitted for this phase — Phase 2 is not a rename/refactor/migration phase. It adds new capabilities (PG integration, PIN settings) while keeping the existing JSON store as fallback. No runtime state is being renamed.

## Common Pitfalls

### Pitfall 1: EADDRINUSE crashes Express silently
**What goes wrong:** `app.listen(3000)` throws an unhandled error when port is in use, crashing the server before the app even creates a window.
**Why it happens:** Express v5 `app.listen()` returns a `net.Server` instance. If the port is in use, the server emits an `'error'` event with `code === 'EADDRINUSE'`. Without a listener, this becomes an uncaught exception that crashes the Node.js process.
**How to avoid:** Always handle `server.on('error', ...)` when calling `app.listen()`. Wrap in a Promise for clean control flow.
**Warning signs:** App starts but no server log, mobile cannot connect.

### Pitfall 2: dotenv not loaded before pg.Pool instantiation
**What goes wrong:** `pg.Pool()` reads `PGHOST`, `PGPORT`, etc. from `process.env` at construction time. If `dotenv.config()` hasn't been called yet, the pool connects to wrong host/database.
**Why it happens:** Module-level `new Pool()` in `db.js` executes at require-time, before `main.js` calls `require('dotenv').config()`.
**How to avoid:** Either (a) create the pool lazily inside a function called after dotenv loads, or (b) call `dotenv.config()` at the top of `db.js` before `new Pool()`. Option (b) is simpler — put `require('dotenv').config()` at the top of `db.js`.
**Warning signs:** Pool connects to default `localhost` with default user, not the configured database.

### Pitfall 3: Concurrent IPC calls to unverified PG connection
**What goes wrong:** If `renderer.js` calls `stock:load` before PG verification completes (or while pool is reconnecting), it gets a connection error with no fallback.
**Why it happens:** IPC handlers are async and start executing immediately. The `init()` function in renderer calls `window.stockApi.load()` as soon as the page loads.
**How to avoid:** Set a `pgConnected` flag in main process after successful `SELECT 1`. IPC handlers check this flag and fall back to JSON store when false. Send the flag to renderer via a `db:status` channel on window creation.
**Warning signs:** Blank dashboard on startup when PG is slow to respond.

### Pitfall 4: bcrypt hash comparison timing
**What goes wrong:** `bcrypt.compareSync()` returns `false` for every comparison when the stored hash format doesn't match.
**Why it happens:** bcrypt stores metadata (algorithm, cost factor, salt) in the hash string itself. If Phase 1 used a different hashing scheme or the PIN was stored without bcrypt, comparison always fails.
**How to avoid:** Phase 1 established bcrypt (D-06). Confirm Phase 1 plan uses `bcryptjs` with `10` rounds. Test PIN set + verify flow end-to-end.
**Warning signs:** PIN verify always returns invalid even after setting PIN.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON file storage (`createStore`) | PostgreSQL via `pg.Pool` | Phase 2 | Data is now queryable, concurrent-safe, shared with Express API. JSON kept as read-only fallback. |
| Express auto-starts on `require('./server.js')` | Express lifecycle managed via `startServer()`/`stopServer()` | Phase 2 | Server starts after PG verification, stops cleanly on app quit, port conflicts handled gracefully. |
| Hardcoded PIN (`SECRET_PIN = "1234"`) | BCrypt-hashed PIN in `app_settings` table | Phase 1 (read) + Phase 2 (write) | PIN manageable via desktop UI, verified via API. Phase 1 created the verify endpoint, Phase 2 adds the management UI. |
| No server status in UI | Footer status indicator (green/red dot) | Phase 2 | User can see at a glance whether Express is running and on which port. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pg` package v8.22.0 (published 2026-06-19) is the legitimate brianc/node-postgres package | Standard Stack | LOW — repo URL and maintainer match the known package. SUS verdict is likely a false positive from recent patch publish. |
| A2 | `dotenv.config()` at the top of `db.js` will make env vars available to `new Pool()` | Pattern 1 | LOW — this is standard dotenv usage. Must ensure `.env` file is loading before Pool construction. |
| A3 | `os.networkInterfaces()` returns interfaces in predictable order on Windows | Pattern 6 | MEDIUM — on Windows, the first non-internal IPv4 might be a virtual adapter (Docker, Hyper-V, VPN). Should filter by preferred interface names or let user see all. |
| A4 | `will-quit` event is reliable for async cleanup across all platforms | Pattern 4 | MEDIUM — Electron docs show `will-quit` is emitted on app.quit() and Cmd+Q. On Windows shutdown, `session-end` fires instead. Use both `will-quit` AND `session-end`. |
| A5 | Phase 1 will have already created the PostgreSQL schema and `app_settings` table | Phase 1 dependency | HIGH — if Phase 1 hasn't run, Phase 2 has no database to connect to. The planner must ensure Phase 1 completes before Phase 2 execution. |
| A6 | Phase 1 populated the `.env` file at project root with working PG credentials | Phase 1 dependency | MEDIUM — the `.env` file doesn't exist in the current state (verified). Phase 1 must create it. |

## Open Questions

1. **Does the `.env` file exist at project root with PG credentials?**
   - What we know: Currently no `.env` file exists. Phase 1 should create it.
   - What's unclear: Whether Phase 1 has run yet and what variable names it uses.
   - Recommendation: The planner should verify Phase 1 completion. Use standard libpq env var names (`PGHOST`, `PGPORT`, etc.) for automatic `pg.Pool` compatibility.

2. **What is the exact PostgreSQL schema created by Phase 1?**
   - What we know: Phase 1 creates `stock_entries` table, `app_settings` table, and a `stock_balance` view.
   - What's unclear: Column names and types (e.g., `created_at` vs `createdAt`, `id` type UUID vs SERIAL).
   - Recommendation: Read Phase 1 plan's SQL schema before implementing Phase 2 queries. The IPC handler examples above assume camelCase fields matching the existing entry model — adjust column names to match Phase 1 schema.

3. **Which network interface should be preferred for local IP display?**
   - What we know: `os.networkInterfaces()` returns all interfaces (Ethernet, WiFi, virtual adapters).
   - What's unclear: Which interface the user considers "primary" for mobile connectivity.
   - Recommendation: Display all non-internal IPv4 addresses, or show the first one with a note to verify. User can see which one matches their actual network.

4. **Should PIN remain validated in renderer if main process also validates?**
   - What we know: Main process MUST validate (security boundary). Renderer validation is UX-only.
   - What's unclear: Whether to duplicate the 4-6 digit regex in renderer for instant feedback, or rely entirely on IPC response.
   - Recommendation: Duplicate validation in renderer for UX (show inline error before submit). Main process validates again as security boundary.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All code | ✓ | v24.16.0 | — |
| npm | Package install | ✓ | v11.17.0 | — |
| PostgreSQL 16+ | Database | ✗ (not detected) | — | Phase 1 must install and configure |
| psql | PostgreSQL CLI | ✗ | — | PGAdmin GUI can be used instead |
| pg_isready | PostgreSQL health check | ✗ | — | Use `pool.query('SELECT 1')` in code |

**Missing dependencies with no fallback:**
- **PostgreSQL 16+** — The entire phase depends on PostgreSQL running. Phase 1 must complete the installation and schema setup before Phase 2 can operate. If PG is not installed, the desktop cannot connect and falls back to read-only JSON mode.

**Missing dependencies with fallback:**
- **psql/pg_isready** — Not required by the code. PG health checks are done via `pg.Pool` queries in the application itself.

## Validation Architecture

> workflow.nyquist_validation is enabled in .planning/config.json.

### Test Framework
The project has **zero existing tests** (no test runner, no test directory, no test scripts in package.json). Phase 2 should introduce testing for critical paths.

| Property | Value |
|----------|-------|
| Framework | Vitest (recommended — lightweight, fast, compatible with Electron) |
| Config file | `vitest.config.js` at project root |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| DKT-01 | Desktop reads stock data from PostgreSQL | Integration | Test requires running PG instance — manual verification recommended for this phase |
| DKT-02 | Desktop writes stock entries to PostgreSQL | Integration | Same as DKT-01 — manual or skip |
| DKT-03 | PIN set/change with validation | Unit (main process logic) | `npx vitest run src/__tests__/pin.test.js` |
| DKT-04 | Local IP detection returns valid non-loopback IPv4 | Unit | `npx vitest run src/__tests__/ip.test.js` |
| DKT-05 | Express server lifecycle (start/stop) | Integration | Manual — server requires port access |

### Sampling Rate
- **Per task commit:** Manual verification (project has no test runner configured yet)
- **Per wave merge:** Run `electron .` and verify each DKT requirement works
- **Phase gate:** Manual UAT — verify all DKT-01 through DKT-05 criteria

### Wave 0 Gaps
- [ ] `vitest` install: `npm install -D vitest`
- [ ] `src/__tests__/pin.test.js` — tests for PIN validation, hashing, IPC patterns
- [ ] `src/__tests__/ip.test.js` — tests for `getLocalIP()` function
- [ ] `vitest.config.js` — test configuration

## Security Domain

> `security_enforcement` not explicitly set in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | PIN-based auth via bcryptjs hashing — API uses `x-access-pin` header compared against bcrypt hash in `app_settings` table |
| V3 Session Management | No | No session concept in MVP. Each API request carries PIN header. Desktop PIN operations are IPC-invoked per action. |
| V4 Access Control | Partial | Renderer cannot access Node.js APIs (contextIsolation). PIN modal updates go through IPC with bcrypt in main process. |
| V5 Input Validation | Yes | PIN: regex `^\d{4,6}$` validated in BOTH renderer (UX) and main process (security). Entry data: PG parameterized queries prevent SQL injection. |
| V6 Cryptography | Yes | bcryptjs for PIN hashing with 10 salt rounds. PIN never stored in plaintext. No hand-rolled crypto. |

### Known Threat Patterns for Electron + Express Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PIN brute force via API | Tampering | Express rate limiting (Phase 1 D-08 via `express-rate-limit`). Desktop PIN operations are local IPC only — not network-exposed. |
| Renderer DevTools access to PIN | Information Disclosure | PIN never stored in renderer state. Form fields cleared after submit/close. contextIsolation prevents renderer from accessing main process memory. |
| Unauthorized local network API access | Spoofing | PIN must be sent as `x-access-pin` header. No PIN = 401/403. PIN verified against bcrypt hash on every request. |
| SQL injection | Tampering | Use `pg` parameterized queries (`$1`, `$2`) — never string-interpolate user input into SQL. |
| Insecure .env file storage | Information Disclosure | `.env` listed in `.gitignore`. Only contains PG connection details, not secrets. PIN hash stored in database, not `.env`. |

### Secret Storage Decision

| Secret | Storage Location | Protection |
|--------|-----------------|------------|
| PG password | `.env` file (not in git) | File system permissions. Listed in `package.json`'s `files` array? Check electron-builder config — `.env` is NOT in the `files` array and will NOT be included in the packaged build. For production, document that `.env` must be created manually alongside the packaged app. |

## Sources

### Primary (HIGH confidence)
- **node-postgres (pg) official docs** — Connecting, Pool API, env vars. Source: node-postgres.com/features/connecting, node-postgres.com/apis/pool [CITED]
- **Electron API docs** — app lifecycle events (will-quit, before-quit, window-all-closed), BrowserWindow, dialog. Source: electronjs.org/docs/latest/api/app [CITED]
- **Express v5 API docs** — app.listen, error handling, graceful shutdown. Source: expressjs.com/en/5x/api.html [CITED]
- **npm registry** — Verified package existence and versions for pg v8.22.0, dotenv v17.4.2, bcryptjs v3.0.3, express-rate-limit v8.5.2. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- **bcryptjs GitHub** — Usage patterns for hash/compare with sync API. Source: github.com/dcodeIO/bcrypt.js [CITED]
- **Stack Overflow** — Electron before-quit vs will-quit behavior on Windows. Source: stackoverflow.com/questions/41364539 [CITED]
- **OneUptime blog** — `os.networkInterfaces()` for local IPv4 detection with cross-platform patterns. Source: oneuptime.com/blog/post/2026-03-20-get-local-ipv4-nodejs [CITED]

### Tertiary (LOW confidence) — all marked in Assumptions Log
- Package publish date interpretations (A1)
- `os.networkInterfaces()` priority on Windows (A3)
- will-quit reliability across all platforms (A4)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — All packages verified on npm registry, official docs reviewed.
- Architecture: **HIGH** — Patterns confirmed against Electron and Express official docs, existing codebase analyzed.
- Pitfalls: **MEDIUM** — Based on community experience (Stack Overflow, GitHub issues) and official docs. Platform-specific behavior (Windows shutdown) has edge cases.

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (30 days — stable packages, Electron v31 is LTS)
