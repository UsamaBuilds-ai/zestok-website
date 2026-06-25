---
phase: 02-desktop-postgresql-integration-pin-management
reviewed: 2026-06-25T12:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/db/pool.js
  - src/server.js
  - src/main.js
  - src/preload.js
  - src/index.html
  - src/styles.css
  - src/renderer.js
  - src/db/migrate.js
  - tests/setup.js
  - tests/db/connection.test.js
  - tests/routes/pin.test.js
  - tests/routes/stock.test.js
findings:
  critical: 1
  warning: 8
  info: 3
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-25T12:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This review covers the Electron desktop app with Express backend, PostgreSQL integration, PIN management, and test suite. The implementation follows a dual-store strategy (PG-primary, JSON-fallback) with PIN-based access control via bcryptjs.

One critical finding relates to data loss risk: the `will-quit` handler does not wait for async cleanup (JSON auto-export) to complete before the process terminates. Eight warnings cover security gaps (missing rate limiting, error message leakage), correctness bugs (wrong server status on alt port), and robustness issues (null references, sync bcrypt blocking the main process). Three info items are minor quality observations.

## Critical Issues

### CR-01: `will-quit` cleanup doesn't prevent app exit — auto-export may not complete (data loss risk)

**File:** `src/main.js:153-158`
**Issue:** The `will-quit` event handler starts async cleanup (stop server, auto-export JSON to disk, close DB pool) but does **not** call `event.preventDefault()`. Electron fires `will-quit` and then immediately terminates the process. The `.then()` chain starts but the Node.js event loop exits before the async operations complete. This means the JSON auto-export — described in the plan as "JSON auto-export on exit for data safety" — may silently fail to write the file, causing data loss on exit.

The `session-end` handler (lines 160-168) has the same structural issue — it uses `async/await` but also doesn't prevent the session from ending.

**Fix:**
```javascript
app.on('will-quit', (event) => {
  event.preventDefault();

  require('./server').stopServer()
    .then(() => {
      const { pool } = require('./db/pool');
      return autoExportToJson().then(() => pool.end());
    })
    .then(() => {
      app.quit(); // Now safe to quit
    })
    .catch(err => {
      console.error('Cleanup error:', err.message);
      app.quit(); // Quit even on error
    });
});
```

## Warnings

### WR-01: Status indicator shows wrong port and wrong running state

**File:** `src/main.js:132-138`
**Issue:** After `await startExpressWithRetry()` completes, a second `server:status-update` IPC message is sent with `running: pgConnected` and `port: parseInt(process.env.PORT, 10) || 3000`. This overwrites the correct status sent inside `startExpressWithRetry()`.

Two bugs result:
1. If the server started on an alternative port (PORT+1), the indicator shows the original port, not the actual one.
2. If PostgreSQL is unavailable but the server started successfully, `pgConnected` is `false`, so the indicator shows "Server Stopped" even though the Express server IS running and accessible.

**Fix:** Remove lines 132-138 entirely. The correct status is already sent from within `startExpressWithRetry()`. If you need to convey PG status separately, use a distinct IPC channel (e.g., `db:status-update`).

### WR-02: PIN IPC handlers throw raw errors that may leak DB connection details to the renderer

**File:** `src/main.js:333-383`
**Issue:** The `pin:set` and `pin:change` handlers use `throw new Error(...)` for validation (fine), but if `pool.query()` throws a PostgreSQL error, that raw error propagates to the renderer. Electron's IPC serializes the error message, and the renderer displays it via `showPinError(err.message)`. A pg error could contain `ECONNREFUSED 127.0.0.1:5432`, `password authentication failed for user "postgres"`, or similar infrastructure details.

**Fix:** Wrap the pool calls in a try-catch that rethrows generic messages:
```javascript
try {
  const existing = await pool.query("SELECT value FROM app_settings WHERE key = 'pin'");
  // ... validation and insert ...
} catch (err) {
  if (err.message.includes('PIN') || err.message.includes('configured')) throw err; // rethrow validation
  throw new Error('Failed to save PIN. Please try again.'); // generic for DB errors
}
```

### WR-03: `bcrypt.hashSync` / `bcrypt.compareSync` block Electron main process

**File:** `src/main.js:348, 373, 376`
**Issue:** The `pin:set` handler uses `bcrypt.hashSync(pin, 10)` (line 348) and `pin:change` uses `bcrypt.compareSync()` (line 373) and `bcrypt.hashSync()` (line 376). These synchronous operations block the Electron main process event loop for ~100-200ms each (bcrypt cost factor 10). During this time, all IPC communication, window rendering, and user interaction is frozen.

In contrast, the Express `verifyPin` middleware (server.js:92) correctly uses `await bcrypt.compare()`.

**Fix:** Use async versions:
```javascript
const hash = await bcrypt.hash(pin, 10);  // instead of bcrypt.hashSync
const isValid = await bcrypt.compare(currentPin, storedHash);  // instead of bcrypt.compareSync
```
Note: Express 5 (used here, per `package.json:57`) handles async middleware errors automatically, and `ipcMain.handle` accepts async functions, so both call sites support async bcrypt.

### WR-04: No rate limiting on `/api/stock` — PIN brute-force possible via stock endpoint

**File:** `src/server.js:112`
**Issue:** `GET /api/stock` applies the `verifyPin` middleware but has no rate limiter. The `pinVerifyLimiter` is only on `GET /api/pin/verify` (line 108). An attacker can bypass the rate limit by sending unlimited requests to `/api/stock` with different PIN values. Each request triggers a `bcrypt.compare` call, making brute-force feasible.

**Fix:** Apply `pinVerifyLimiter` (or a separate limiter) to the stock endpoint:
```javascript
app.get('/api/stock', pinVerifyLimiter, verifyPin, async (req, res) => {
```

### WR-05: Potential null reference in `/api/pin/status`

**File:** `src/server.js:62`
**Issue:** Line 62 reads `result.rows[0].value.length > 0`. If the `value` column is NULL in the database (which the schema may allow), this throws `TypeError: Cannot read properties of null (reading 'length')`. The catch block returns 503, masking the actual error and confusing diagnostics.

**Fix:**
```javascript
const configured = result.rows.length > 0 && result.rows[0].value && result.rows[0].value.length > 0;
```

### WR-06: PDF export HTML template doesn't escape title/subtitle

**File:** `src/main.js:267-268`
**Issue:** `${payload.title}` and `${payload.subtitle}` are interpolated directly into HTML without calling `escapeHtml()`. Currently safe because the renderer passes `textContent` (which strips HTML). However, if the title/subtitle source ever changes to include user-controlled HTML, this becomes an XSS vulnerability. Defense in depth dictates escaping all interpolated values in HTML templates.

**Fix:**
```html
<h1>${escapeHtml(payload.title)}</h1>
<p>${escapeHtml(payload.subtitle)}</p>
```

### WR-07: `preload.js` IPC listener never removed — potential listener leak

**File:** `src/preload.js:8`
**Issue:** `ipcRenderer.on('server:status-update', ...)` registers a persistent listener. If `getServerStatus` is called multiple times (e.g., on component remount or hot reload), listeners accumulate and the callback fires multiple times per event. Currently only called once in `init()`, but the API surface permits repeated calls.

**Fix:** Use `ipcRenderer.once` if only needed once, or return an unsubscribe function:
```javascript
getServerStatus: (callback) => {
  const handler = (_event, status) => callback(status);
  ipcRenderer.on('server:status-update', handler);
  return () => ipcRenderer.removeListener('server:status-update', handler);
}
```

### WR-08: Silent fallback from PostgreSQL to JSON without user notification

**File:** `src/main.js:190-193, 240-243`
**Issue:** When PG operations fail (in `stock:load` and `stock:save`), `global.pgConnected` is set to `false` and data falls back to the JSON store. The user is never informed that data was saved to JSON instead of PostgreSQL. This can lead to confusion — the user believes data is in the database but it's only in a local JSON file.

**Fix:** Send a notification to the renderer when PG fails:
```javascript
} catch (err) {
  console.error("PG save failed:", err.message);
  global.pgConnected = false;
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send('db:status-update', { connected: false });
  }
}
```

## Info

### IN-01: `dotenv` loaded twice

**Files:** `src/db/pool.js:1`, `src/main.js:109`
**Issue:** `require('dotenv').config()` is called in both `pool.js` and `main.js`. This is harmless (dotenv ignores duplicate calls) but redundant. Since `pool.js` is imported by `main.js`, the `pool.js` load happens first.

**Fix:** Remove the `require('dotenv').config()` from `main.js:109` since `pool.js` already handles it. Alternatively, centralize it in a single entry-point module.

### IN-02: `console.log` statements in production code

**Files:** `src/server.js:18`, `src/db/migrate.js:22,32,40,49,77`
**Issue:** Various `console.log` calls remain in production code. In an Electron app, these write to the main process stdout/stderr which may not be visible to users. Consider using a structured logger or removing informational logs for production builds.

**Fix:** For `server.js:18`, consider removing or using a debug-level logger. For `migrate.js`, `console.log` is acceptable since it's a CLI script.

### IN-03: Both `bcrypt` and `bcryptjs` listed as dependencies

**Files:** `package.json:53-54`
**Issue:** The project lists both `bcrypt` (native C++ addon, `^6.0.0`) and `bcryptjs` (pure JavaScript, `^3.0.3`) as dependencies. The source code (`server.js`, `main.js`) uses `bcryptjs`, while `tests/routes/stock.test.js:19` uses `require('bcrypt')`. This works but doubles the dependency footprint and creates inconsistency. Native `bcrypt` requires compilation during install, which can fail on some platforms.

**Fix:** Standardize on one library. If `bcryptjs` is the chosen library (pure JS, no native deps), update `stock.test.js:19` to use `require('bcryptjs')` and remove `bcrypt` from `package.json`.

---

_Reviewed: 2026-06-25T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
