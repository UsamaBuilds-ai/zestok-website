# Phase 4: Dashboard — Metrics & Stock Table - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the main dashboard with 4 metric cards (Total Items, Balance Qty, Stock Value, Today's Movement) and a scrollable stock balance table (7 columns: Item, Category, In, Out, Balance, Rate, Value) with real-time search. Data fetched from `/api/entries`, balances computed client-side (replicating `getBalances()` from Electron app). Add offline cache with stale-data indicator and biometric unlock on app resume.

</domain>

<decisions>
## Implementation Decisions

### Post-Auth Screen Flow
- **D-39:** After PIN verification succeeds (`hidePinGate()`), replace the health check UI entirely with the dashboard layout. The health check is only a bootstrap concern — once authenticated, the user sees data immediately.
- **D-40:** Keep the retry bar pattern from Phase 2 for transient errors that occur after authentication (e.g., API call to `/api/entries` fails). The retry bar shows at bottom of screen during dashboard usage.

### Metric Cards Layout
- **D-41:** 4 metric cards displayed in a 2x2 grid layout — fits mobile screen width, gives each card enough space, standard mobile dashboard pattern.
- **D-42:** Each card shows: label (e.g., "Total Items"), value formatted with PKR Rs and comma separators, and a subtle icon or indicator.

### Offline Cache Strategy
- **D-43:** Cache entries JSON in `@capacitor/preferences` under key `cachedEntries` — serialized array of entries. Also store `cachedTimestamp` for staleness detection.
- **D-44:** On dashboard open: call `getEntries()` via `apiRequest`. On success, write response to Preferences cache. On failure (offline detected via `connectivity.js`): read from Preferences cache, calculate metrics/balances from cached data.
- **D-45:** When showing cached data, display a visible banner: "Stale data — last updated [timestamp]" below the header, using the same banner pattern as `session-expired-banner`.
- **D-46:** Cache is refreshed on every successful `/api/entries` call — no separate cache expiry. Freshness is determined by whether the API call succeeds or we fall back to cache.

### Search & Filter UX
- **D-47:** Real-time client-side filter with 300ms debounce. Each keystroke resets the debounce timer; when it fires, filter the already-loaded balances array by item name or category using the same `keyFor().includes()` pattern from the Electron app.
- **D-48:** No "Search" button — results update instantly. On search clear (empty input), restore full list immediately.
- **D-49:** Dismiss mobile keyboard when user taps outside the search input or clears the field.

### Biometric Unlock
- **D-50:** Use `@capacitor/biometric` plugin for fingerprint/face authentication.
- **D-51:** On app resume (via `App.addListener('appStateChange')`): attempt biometric auth first. If biometrics are available and succeed, skip the PIN gate and go straight to dashboard. If biometrics are unavailable, fail, or user cancels, fall back to PIN gate (D-29 from Phase 3).
- **D-52:** No separate enrollment screen — once biometrics succeed for the first time, store a `biometricEnabled` flag in Preferences. On subsequent resumes, check this flag to decide whether to attempt biometrics first or go straight to PIN.

### The Agent's Discretion
- Exact card styling (colors, icon placement) — follows existing dark theme from `style.css`
- Search input placement — above the stock table, standard pattern
- Refresh indicator (pull-to-refresh or manual button) — standard mobile pull-to-refresh is idiomatic
- Error state for dashboard data load failure — follow existing inline error and retry patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Requirements
- `.planning/ROADMAP.md` §Phase 4 — Phase goal, success criteria, plan outline
- `.planning/REQUIREMENTS.md` §DASH-01 through DASH-06, CONN-03, UI-02, UX-04 — Full requirements traceability

### Active Decisions from Prior Phases
- `.planning/phases/03-pin-authentication-session-management/03-CONTEXT.md` — D-26 (Preferences storage), D-28 (getAuthHeaders), D-29/D-30 (app resume → PIN gate), D-31/D-32 (offline PIN cache)
- `.planning/phases/02-api-connectivity-network-layer/02-CONTEXT.md` — D-14 (apiRequest wrapper), D-17 (structured response), D-18 (getEntries convenience function), D-19/D-20 (connectivity module), D-23/D-24 (retry bar & error patterns)
- `.planning/phases/01-project-setup-toolchain/01-CONTEXT.md` — D-09 (Preferences plugin), D-10 (App plugin)

### Codebase Reference
- `mobile/src/api.js` — `getEntries()` calls `/api/entries` with auth headers
- `mobile/src/auth.js` — Auth state, session, offline PIN verification
- `mobile/src/connectivity.js` — `isConnected()` for offline detection
- `mobile/src/main.js` — App entry, PIN gate flow, health check (to be replaced by dashboard)
- `mobile/src/style.css` — Theme variables, retry bar, inline error, spinner patterns
- `src/renderer.js:424-453` — `getBalances()` function (balance calculation logic to replicate client-side)
- `src/renderer.js:489-536` — `renderMetrics()` and `renderBalanceRows()` (reference for layout patterns)
- `src/server.js:431-455` — `GET /api/entries` response shape (`{ entries: [...] }`)
- `src/server.js:101-113` — `stock_balance` view SQL (reference for balance computation)

### Architecture & Stack
- `.planning/codebase/ARCHITECTURE.md` — System architecture, PIN auth flow, offline patterns
- `.planning/codebase/INTEGRATIONS.md` — API endpoints, auth header conventions
- `.planning/codebase/STACK.md` — Capacitor v8, vanilla JS, bcryptjs
- `.planning/codebase/CONVENTIONS.md` — Coding standards (camelCase, async/await, kebab-case files)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/api.js:66-68` — `getEntries()` already calls `/api/entries` with `auth: true` — ready to use
- `mobile/src/connectivity.js:6-8` — `isConnected()` for offline vs online branching
- `mobile/src/style.css:127-197` — Retry bar pattern, inline error pattern, spinner pattern — reuse for dashboard error states
- `mobile/src/main.js:29-31` — `updateNetworkBadge()` — extend to show stale-data indicator
- `mobile/index.html` — Current app shell; dashboard HTML will replace the `<main>` section after auth

### Established Patterns
- **Module-level state + subscriber pattern** — From `connectivity.js` and `auth.js`; dashboard state (entries, balances) should follow same approach
- **fetch() + AbortController** (10s timeout) — Established for all API calls; use for `/api/entries` call
- **Structured API responses** — `{ ok, data, error, status }` from D-17
- **Prefixed CSS classes** — `.pin-*`, `.network-*`, `.spinner-*` conventions; new dashboard classes follow `.metric-*`, `.stock-table-*`, `.search-*` pattern

### Integration Points
- Backend `GET /api/entries` — Returns `{ entries: [{ id, date, type, item, category, quantity, rate, note, createdAt }] }` — authenticate via `x-access-pin` header (already injected by `getAuthHeaders`)
- `@capacitor/preferences` — Store cached entries (`cachedEntries`) and timestamp (`cachedTimestamp`) for offline fallback
- `@capacitor/biometric` — New plugin for biometric unlock on resume
- `@capacitor/app` — `appStateChange` event triggers biometric check or PIN gate

</code_context>

<specifics>
## Specific Ideas

- Balance calculation replicates `getBalances()` from `src/renderer.js:424-453` — reduce entries by item, compute in/out/balance/value per item
- Offline fallback mirrors Phase 3 offline PIN pattern: try server → cache on success → read from cache on failure with stale banner
- Search/filter pattern mirrors Electron's `renderBalanceRows` search at `src/renderer.js:516-517`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Dashboard — Metrics & Stock Table*
*Context gathered: 2026-07-08*
