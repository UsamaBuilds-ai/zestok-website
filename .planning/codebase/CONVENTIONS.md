# Coding Conventions

**Analysis Date:** 2026-07-07

## Languages & Runtime

**Language:** JavaScript (ES2021+) — no TypeScript detected
**Module System:** CommonJS (`require()` / `module.exports`)
**Target:** Electron v31 + Node.js (bundled with Electron)

## Naming Patterns

**Files:**
- kebab-case for all source files: `renderer.js`, `preload.js`, `main.js`, `server.js`, `credential.js`, `migrate-pin.js`
- PascalCase for SQL schema files: `schema.sql` (single-word exception)
- CSS file: `styles.css`

**Functions:**
- camelCase consistently across all files
- Factory functions use `create` prefix: `createPinStore()`, `createDataFile()`, `createConfigStore()` (`src/main.js:20-78`)
- Event handler functions use `handle` prefix: `handlePinSetup()`, `handlePinLogin()` (`src/renderer.js:213,300`)
- Async operations described with verb+noun: `showPinGate()`, `unlockApp()`, `syncToServer()`, `bindEvents()`
- Internal/private prefix with underscore: `_prevServerOk`, `_unlock`, `_dirty`, `_syncing`, `_unlocked`, `_currentPin` (`src/renderer.js:44-48`)
- Verb+noun for render functions: `renderMetrics()`, `renderBalanceRows()`, `renderDatalist()`, `renderRateCheck()`, `renderReportRows()` (`src/renderer.js:483-577`)

**Variables:**
- camelCase for all identifiers
- Constants at module scope in UPPER_SNAKE_CASE: `PIN_GATE_DELAY_MS`, `STATUS_POLL_RETRIES`, `STATUS_POLL_INTERVAL_MS`, `STATUS_REFRESH_INTERVAL_MS`, `MIGRATION_KEY`, `TIMEOUT` (`src/renderer.js:2-5`, `src/db/pool.js:50`, `src/db/migrate.js:5`)
- File path constants in UPPER_SNAKE_CASE: `PIN_FILE`, `DATA_FILE`, `CONFIG_FILE` (`src/main.js:16-18`)
- Module-level mutable state in lowercase: `state`, `pinStore`, `dataStore`, `mainWindow`

**Types/Interfaces:**
- Not applicable — pure JavaScript project, no TypeScript

**IPC Channel Names:**
- Namespaced with colon-separated segments: `config:get-api-url`, `config:get`, `config:save`, `pin:save-local`, `pin:load-local`, `pin:clear-local`, `pin:status`, `pin:verify`, `data:load-local`, `data:save-local`, `stock:export-report-pdf`, `update:check`, `update:download`, `update:install`, `update:checking`, `update:available`, `update:not-available`, `update:download-progress`, `update:downloaded`, `update:error`, `app:version` (`src/main.js:146-159`, `src/preload.js:4-25`)

## Code Style

**No linting/formatting tool detected** — no `.eslintrc`, `.prettierrc`, `eslint.config.*`, `biome.json`, or similar found in the repo.

**Semicolons:** Used consistently throughout all files — every statement ends with `;`.

**Quotes:** Double quotes (`"`) preferred for strings. Single quotes (`'`) used occasionally in server code (`src/server.js`, `server/index.js`).

**Variable Declarations:**
- `const` for all values that are not reassigned (majority)
- `let` for mutable state variables:
  ```js
  let pinStore;
  let dataStore;
  let configStore;
  let mainWindow;
  ```
  (`src/main.js:80-83`)
- No `var` usage detected anywhere in the codebase.

**Async Patterns:**
- `async/await` used for all asynchronous operations — no raw Promise chains or callbacks
  ```js
  app.whenReady().then(async () => { ... });
  ```
  (`src/main.js:141`)
- Arrow functions for callbacks and array methods:
  ```js
  const filtered = balances.filter((item) => keyFor(...));
  ```

**Template Literals:** Used consistently for string interpolation:
```js
console.log('Created database: ' + dbName);  // occasional concat
`${escapeHtml(payload.title)}`                // preferred in render code
```

**Object Shorthand:** Used where applicable:
```js
return { read, write };
```

**Destructuring:** Used for imports and parameter unpacking:
```js
const { app, BrowserWindow, ipcMain } = require("electron");
const { API_URL } = require("./config.js");
```

## Import Organization

**Order (observed in `src/main.js`):**
1. Node.js built-in modules (`crypto`, `bcrypt`, `path`, `fs/promises`, `electron`)
2. Third-party packages (`electron-updater`)
3. Local modules (`./config.js`)

**No path aliases** — all local imports use relative paths (`./config.js`, `../src/server`, `../src/db/pool`).

**No barrel files** — each module is imported directly from its source file.

## Error Handling

**Patterns observed:**

1. **try/catch with fallback** — the most common pattern:
   ```js
   try {
     const content = await fs.readFile(filePath, "utf8");
     return JSON.parse(content);
   } catch {
     return { entries: [] };
   }
   ```
   (`src/main.js:44-49`)

2. **try/catch with console.error + rethrow:**
   ```js
   try {
     // ...
   } catch (err) {
     console.error("pin:save-local failed:", err);
     throw err;
   }
   ```
   (`src/main.js:181-184`)

3. **try/catch with user-facing message:**
   ```js
   try {
     // ...
   } catch (e) {
     msg.textContent = "Server unreachable. Please try again when connected.";
   }
   ```
   (`src/renderer.js:290-297`)

4. **Global error handlers:**
   ```js
   process.on('uncaughtException', (err) => {
     console.error('Uncaught exception:', err);
     app.quit();
     process.exit(1);
   });
   ```
   (`src/main.js:5-9`)
   ```js
   window.onerror = (msg, url, line, col, err) => {
     console.error('Uncaught error:', err || msg);
     return true;
   };
   window.addEventListener('unhandledrejection', (e) => {
     console.error('Unhandled rejection:', e.reason);
     e.preventDefault();
   });
   ```
   (`src/renderer.js:7-14`)

5. **Silent catch for non-critical failures:**
   ```js
   } catch {}
   ```
   (`src/renderer.js:120`, `src/main.js:234`)

**HTTP Error Handling Pattern:**
```js
const res = await fetch(`${API}/api/pin/status`);
if (res.ok) {
  const d = await res.json();
  return { configured: d.configured, companyName: d.company_name || '' };
}
```
(`src/renderer.js:113-118`)

**Express Error Middleware:**
```js
app.use((err, req, res, next) => {
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({ ... });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
});
```
(`src/server.js:547-556`)

**Database error handling — permission repair retry:**
```js
if (err.message && err.message.includes('permission denied')) {
  await repairTenantPermissions(req.dbName);
  try { /* retry query */ } catch {}
}
```
(`src/server.js:440-450,519-524`)

## Logging

**Framework:** No logging library — uses `console.log` and `console.error` only.

**Patterns:**
- `console.error` for errors, always includes context label: `console.error("pin:save-local failed:", err)`
- `console.log` for server startup and operational messages
- `console.error` in global handlers for uncaught exceptions/rejections
- `console.warn` not observed
- No structured logging, no log levels, no rotation

## Comments

**Pattern:**
- Minimal comments — the codebase is largely self-documenting through clear naming
- One code comment observed: `// Named constants (replaces magic numbers)` (`src/renderer.js:1`)
- SQL comments in `schema.sql` for table/view descriptions
- No JSDoc or TSDoc annotations anywhere in the codebase

**When to Comment (extrapolated from codebase patterns):**
- Explain *why*, not *what* — code is expected to be self-documenting
- Add comments for non-obvious business logic or workarounds

## Function Design

**Size:** Highly variable — helper functions are 2-15 lines, while complex render functions are 15-50 lines.

**Parameters:** Typically 0-3 parameters. IPC handlers have `(_event, data)` signature consistently.

**Return Values:**
- Factory functions return object with methods: `{ read, write }`
- Async functions return promises (using async/await)
- IPC handlers return values or throw to reject the promise
- Boolean functions check with `!!` coercion at call sites: `!!(localPin && (localPin.pin_hash || localPin.configured))`

## Module Design

**Exports:**
- `module.exports = { ... }` for multi-export modules
- `module.exports = app` for single-export (Express app)
- Named exports only — no `module.exports = function` pattern

**Barrel Files:** Not used.

**Module Responsibilities (observed pattern):**
| Module | Role |
|--------|------|
| `src/main.js` | Electron main process — window creation, IPC handlers, file I/O |
| `src/renderer.js` | DOM rendering, state management, UI events |
| `src/preload.js` | Context bridge — IPC API surface for renderer |
| `src/server.js` | Express app — routes, middleware, DB queries |
| `src/db/pool.js` | PostgreSQL connection pool management |
| `src/credential.js` | Credential file I/O (sync) |

---

*Convention analysis: 2026-07-07*
