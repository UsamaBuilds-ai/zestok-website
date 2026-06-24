# Phase 1: PostgreSQL + API Foundation - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Setup PostgreSQL database with stock entries and app settings tables, migrate Express API from mock data to real PostgreSQL queries, create PIN verification endpoint with bcrypt hashing, provide data migration from existing JSON file, and include comprehensive setup instructions for Windows PostgreSQL installation.
</domain>

<decisions>
## Implementation Decisions

### DB Connection Config
- **D-01:** PostgreSQL connection details stored in `.env` file loaded via dotenv — host, port, database name, user, password
- **D-02:** PostgreSQL installed manually via official Windows installer (postgresql.org) — detailed step-by-step setup instructions included in plan
- **D-03:** Database name: `stock_db`
- **D-04:** PostgreSQL port: 5432 (default)

### PIN Bootstrapping
- **D-05:** `GET /api/pin/status` returns `{ configured: false }` when no PIN has been set — API rejects mobile requests until desktop configures PIN in Phase 2
- **D-06:** PIN stored as bcrypt hash in `app_settings` table — plain text never persisted
- **D-07:** No default PIN — desktop Phase 2 provides the PIN settings page. Phase 1 API returns "not configured" state
- **D-08:** Rate limiting added to PIN verify endpoint in Phase 1 via `express-rate-limit` — prevents brute force from day one

### API Error Handling
- **D-09:** PostgreSQL unreachable → HTTP 503 with `{ error: 'database_unreachable', message: '...' }`
- **D-10:** Wrong PIN → HTTP 401 with `{ valid: false, message: 'Invalid PIN' }`
- **D-11:** PIN not configured → HTTP 200 with `{ configured: false, valid: false }`
- **D-12:** Schema validation errors → HTTP 400 with specific error details in response body

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — 26 v1 requirements with traceability to phases (Phase 1: DB-01–05, API-01–06)
- `.planning/ROADMAP.md` — Phase 1 success criteria and phase boundaries
- `.planning/PROJECT.md` — Project context, constraints, key decisions

### Codebase Maps
- `.planning/codebase/STACK.md` — Current technology stack (Express v5.2.1, Electron v31, no database)
- `.planning/codebase/ARCHITECTURE.md` — System architecture, data model, data flow
- `.planning/codebase/INTEGRATIONS.md` — Current integrations (Express mock API, JSON file storage)
- `.planning/codebase/CONCERNS.md` — Known issues (hardcoded PIN, mock data, flat file storage)

### Source Files
- `src/server.js` — Current Express API (mock data, hardcoded PIN "1234") — primary file to migrate
- `src/main.js` — Electron main process with JSON file persistence (createStore factory lines 6-27)
- `src/renderer.js` — UI with getBalances() logic (line 22-51) — reference for balance calculation
- `src/preload.js` — IPC bridge

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Express server** (`src/server.js`): Already serves on port 3000 with CORS enabled — just needs DB integration
- **Balance calculator** (`src/renderer.js:22`): `getBalances()` logic computes item balances from flat entries — should be ported to SQL view

### Established Patterns
- **Entry data model**: `{ id, date, type (in/out), item, category, quantity, rate, note, createdAt }` — table schema must match
- **Balance model**: Computed from entries — `{ item, category, inQty, outQty, balance, latestRate, value }`

### Integration Points
- **Express server** on `0.0.0.0:3000` — endpoints to modify: `/api/stock`, `/api/pin/verify`, add `/api/pin/status`
- **JSON file** at `app.getPath("userData")/stock-data.json` — data source for migration
- **Desktop main process** (`src/main.js:6-27`) — `createStore()` factory reads/writes JSON — migration target from JSON to PG

</code_context>

<specifics>
## Specific Ideas

- Setup instructions should cover: downloading from postgresql.org, running installer, setting postgres password, creating `stock_db` database, verifying connection
- Migration script should be a one-time Node.js script that reads `stock-data.json` and inserts into PostgreSQL — called manually or as part of app startup when DB is empty
- Express should use `pg` package with connection pool for PostgreSQL queries
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 1-PostgreSQL + API Foundation*
*Context gathered: 2026-06-24*
