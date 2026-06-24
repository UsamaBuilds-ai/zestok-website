# Phase 2: Desktop PostgreSQL Integration + PIN Management - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate desktop Electron app from JSON file storage to PostgreSQL, add PIN settings page with modal dialog, display local IP for mobile connection, integrate Express server auto-start with Electron lifecycle, and implement auto-export to JSON on app exit as backup.
</domain>

<decisions>
## Implementation Decisions

### Desktop→DB Connection
- **D-01:** Desktop main process connects to PostgreSQL directly via `pg` package (not through Express API)
- **D-02:** Desktop reads database config from same `.env` file as Express — shared configuration
- **D-03:** Verify PostgreSQL connectivity on app startup — show error dialog and block usage if unreachable
- **D-04:** When PostgreSQL is down, display "Database unavailable" error and prevent data entry until connection restored

### PIN Settings UI
- **D-05:** PIN settings appear as a modal/dialog opened from a gear icon or settings button — not a new tab
- **D-06:** Form fields: If no PIN exists → "Set PIN" + "Confirm PIN". If PIN exists → "Current PIN" + "New PIN" + "Confirm New PIN"
- **D-07:** Local IP address for mobile connection displayed on the same PIN settings dialog
- **D-08:** PIN must be 4-6 numeric digits only

### Express Auto-Start
- **D-09:** Express server starts in Electron's main process on app `ready` event — before window opens
- **D-10:** Server gracefully closes on `before-quit` or `will-quit` event — clean port release
- **D-11:** If port 3000 is in use: show dialog with options (Retry / Use alternative port / Cancel). Chosen port displayed in status indicator
- **D-12:** Server status indicator (Running/Stopped) shown in app footer

### JSON File Strategy
- **D-13:** PostgreSQL is the source of truth — desktop reads/writes PG for all operations
- **D-14:** JSON file (`stock-data.json`) kept as read-only fallback — loaded only when PostgreSQL is unreachable
- **D-15:** Auto-export current data to JSON on app exit — creates/updates backup file for next session fallback

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Context (carries forward)
- `.planning/phases/01-postgresql-api-foundation/01-CONTEXT.md` — Phase 1 decisions: PG config (`.env`, port 5432, DB `stock_db`), bcrypt PIN hashing, rate limiting, API error codes

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: DKT-01 through DKT-05
- `.planning/ROADMAP.md` — Phase 2 success criteria and boundaries
- `.planning/PROJECT.md` — Project context, constraints, key decisions

### Codebase Maps
- `.planning/codebase/STACK.md` — Technology stack (Electron v31, Express v5.2.1, no database currently)
- `.planning/codebase/ARCHITECTURE.md` — System architecture, IPC data flow, data model
- `.planning/codebase/INTEGRATIONS.md` — Current integrations (Express mock API, JSON file storage)
- `.planning/codebase/CONCERNS.md` — Known issues (hardcoded PIN, flat file storage, mock data)

### Source Files
- `src/main.js` — Electron main process: IPC handlers (stock:load, stock:save), createStore factory, window management — PRIMARY file for Phase 2 changes
- `src/server.js` — Express API — needs lifecycle integration with main.js
- `src/renderer.js` — UI logic — needs PIN settings modal, IP display, server status indicator
- `src/preload.js` — IPC bridge — may need new channels for PIN operations
- `src/index.html` — SPA structure — may need settings modal HTML
- `src/styles.css` — Styling — modal styles, status indicator

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **IPC pattern** (`src/main.js`): `ipcMain.handle()` + `preload.js` `contextBridge` — established pattern for renderer↔main communication. New PIN and data operations follow same pattern.
- **Tab navigation** (`src/index.html`, `src/renderer.js`): Existing tab system for Dashboard/Entry/Report. Settings modal (not a tab) uses different pattern.
- **createStore** (`src/main.js:6-27`): Factory for file I/O — will be partially replaced by PG operations but kept for JSON fallback and auto-export.

### Established Patterns
- **Event-driven render**: `render()` function redraws UI on data change — will need update when data source switches from JSON to PG
- **State object** (`src/renderer.js:1`): Central `state` with `entries[]` — data loaded from PG instead of JSON

### Integration Points
- **`src/main.js` IPC handlers**: `stock:load` → change to PG SELECT query. `stock:save` → change to PG INSERT.
- **`src/main.js` app lifecycle**: `app.whenReady()` → add Express start + PG connection check. `app.on('before-quit')` → add Express stop + JSON auto-export.
- **`src/renderer.js`**: New IPC calls for PIN operations (set, change, verify)

</code_context>

<specifics>
## Specific Ideas

- Use `pg` package with connection pool in main process, shared via a db module
- `.env` file at project root with: `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`
- PIN settings modal: simple overlay with centered dialog box, matches existing CSS style
- Auto-export: before app quits, run SELECT on all entries, write to `stock-data.json`
- Server status: small colored dot (green/red) + text in footer bar

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 2-Desktop PostgreSQL Integration + PIN Management*
*Context gathered: 2026-06-24*
