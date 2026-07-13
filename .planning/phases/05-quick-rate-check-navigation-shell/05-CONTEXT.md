# Phase 5: Quick Rate Check & Navigation Shell - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the rate check screen with autocomplete item search (display latest rate + current balance for selected item), a bottom navigation bar with 3 tabs (Dashboard, Rate Check, Settings), a Settings screen (company name, server health, app version, sign-out), and the sign-out flow that clears session and returns to PIN gate.

</domain>

<decisions>
## Implementation Decisions

### Bottom Navigation Structure
- **D-53:** Bottom navigation bar with 3 fixed tabs — Dashboard, Rate Check, Settings. Uses view sections pattern: each tab maps to a `<div>` in index.html (`#dashboard-view`, `#ratecheck-view`, `#settings-view`) with show/hide toggling, matching the existing Phase 4 pattern.
- **D-54:** Header text updates per active tab. Bottom nav bar is always visible after authentication (below the header, above the content area). Active tab visually highlighted.

### Rate Check UX
- **D-55:** Rate check input filters the local `_balances` array client-side (same data already loaded by dashboard via `/api/entries`). Uses same 300ms debounce pattern from D-47 (Phase 4). User types → dropdown list of matching items → tap to select → shows latest rate and current balance for that item. No separate API call needed.

### Settings Screen
- **D-56:** Settings displays: company name (from session stored in Preferences), live server health status (calls `/api/health` via existing `getHealth()`), app version (to be determined — agent discretion), and sign-out button. Follows the retry/error patterns from Phase 2 for health check.

### Sign-Out & Session Clear
- **D-57:** Sign-out clears `accessPin` from Preferences (forces PIN re-entry on next app start). Does NOT clear `pinHash` (enables offline PIN verification if re-entered) or `cachedEntries` (preserves offline data). No confirmation dialog — sign-out happens immediately. App returns to PIN gate after clearing.
- **D-58:** Also clears `biometricEnabled` flag so biometric unlock doesn't attempt on next resume after sign-out.

### The Agent's Discretion
- Exact design and styling of the bottom navigation bar (color, height, active indicator style) — follows existing dark theme variables from `style.css`
- Rate check autocomplete dropdown style (positioning, max-height, scroll)
- Settings layout (list-style items or cards)
- App version source (Capacitor plugin, hardcoded build constant, or `navigator.userAgent`)
- Rate check display format (same `formatRate()`/`formatQty()` from dashboard.js)
- Whether to show "No item selected" state vs empty state on rate check
- Header text content per tab (e.g., "Dashboard", "Rate Check", "Settings")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Requirements
- `.planning/ROADMAP.md` §Phase 5 — Phase goal, success criteria, plan outline
- `.planning/REQUIREMENTS.md` §DASH-07 through DASH-09 (Rate Check), §UI-01 through UI-04 (Navigation & UI) — Full requirements traceability

### Active Decisions from Prior Phases
- `.planning/phases/04-dashboard-metrics-stock-table/04-CONTEXT.md` — D-47/D-48 (real-time 300ms debounce search), D-39 (showDashboard hidePinGate pattern), D-41/D-42 (metric cards layout)
- `.planning/phases/03-pin-authentication-session-management/03-CONTEXT.md` — D-26 (accessPin in Preferences), D-28 (getAuthHeaders), D-29/D-30 (app resume → PIN gate), D-31/D-32 (bcrypt pinHash for offline)
- `.planning/phases/02-api-connectivity-network-layer/02-CONTEXT.md` — D-14 (apiRequest wrapper), D-19/D-20 (connectivity.js), D-23/D-24 (retry bar & error patterns)
- `.planning/phases/01-project-setup-toolchain/01-CONTEXT.md` — D-09 (Preferences plugin), D-10 (App plugin)

### Codebase Reference
- `mobile/src/dashboard.js` — `showDashboard()`/`hideDashboard()` view show/hide pattern to replicate for rate check and settings views
- `mobile/src/main.js` — App lifecycle, PIN gate flow, view initialization pattern
- `mobile/src/balances.js` — `getBalances()` output shape; rate check filters this `_balances` array
- `mobile/src/style.css` — Theme variables, retry bar, inline error patterns
- `mobile/src/api.js` — `getEntries()`, `getHealth()` endpoint calls
- `mobile/src/auth.js` — Auth state, session management, biometric check
- `mobile/src/connectivity.js` — `isConnected()` for offline detection on health check
- `mobile/index.html` — Current app shell (add rate check and settings sections + bottom nav)
- `src/renderer.js:538-546` — `renderRateCheck()` Electron reference implementation
- `src/renderer.js` — Tab system pattern (Electron app's tab switching for reference)

### Architecture & Stack
- `.planning/codebase/ARCHITECTURE.md` — System architecture, data flow
- `.planning/codebase/STACK.md` — Capacitor v8, vanilla JS stack
- `.planning/codebase/CONVENTIONS.md` — Coding standards (kebab-case files, camelCase functions, double quotes)
- `.planning/codebase/STRUCTURE.md` — Where new code goes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/dashboard.js:120-140` — `showDashboard()`/`hideDashboard()` provides the view show/hide pattern. Replicate for rate check and settings views.
- `mobile/src/balances.js` — `getBalances()` produces `_balances` array with `{ item, category, latestRate, balance }` — rate check autocomplete filters this array.
- `mobile/src/api.js` — `getHealth()` for Settings server status; `getEntries()` already populates balances.
- `mobile/src/main.js:30-33` — `updateNetworkBadge()` pattern for online/offline indicator, reusable for Settings health status.
- `mobile/src/style.css:127-197` — Retry bar, inline error, spinner patterns for Settings health check error states.
- `mobile/src/auth.js` — Session state, `verifyPin()`, `onAuthChange()` — sign-out adds a `clearSession()` here.

### Established Patterns
- **Module-level state + subscriber pattern** — From connectivity.js and auth.js; rate check and settings follow same approach
- **View show/hide pattern** — `#dashboard-view` classList toggle; rate check and settings get their own view divs
- **300ms debounce search** — From D-47 Phase 4; rate check autocomplete reuses same pattern
- **fetch() + AbortController** (10s timeout) — Established for all API calls
- **Prefixed CSS classes** — Existing `.pin-*`, `.metric-*`, `.stock-table-*`, `.search-*` conventions; new classes follow `.nav-*`, `.ratecheck-*`, `.settings-*` pattern
- **Error handling** — Structured `{ ok, data, error, status }` responses from D-17; retry bar for transient, inline error for persistent

### Integration Points
- Bottom nav replaces need for manual view navigation — 3 tabs map to existing `#dashboard-view`, new `#ratecheck-view`, new `#settings-view`
- Sign-out hooks into existing `onAuthChange()` subscriber — when auth state clears, PIN gate re-shows
- Health check view in Settings reuses `getHealth()` from Phase 2
- Autocomplete filters the `_balances` array already populated by `loadDashboard()` — no additional API call needed
- `Preferences.remove({ key: 'accessPin' })` + `Preferences.remove({ key: 'biometricEnabled' })` for sign-out
- App version — use `Build` info or hardcoded constant in a config module

</code_context>

<specifics>
## Specific Ideas

- Rate check UI mirrors Electron's `renderRateCheck()` at `src/renderer.js:538-546` — user types item name, filtered list shows, tapping a match reveals latest rate and current balance
- Bottom nav pattern is standard mobile: fixed bottom bar with icon + label per tab, active state styling
- No separate API endpoint needed for rate check — data is already in `_balances`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Quick Rate Check & Navigation Shell*
*Context gathered: 2026-07-09*
