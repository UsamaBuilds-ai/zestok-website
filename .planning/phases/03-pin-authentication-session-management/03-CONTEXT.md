# Phase 3: PIN Authentication & Session Management - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the PIN entry screen, wire up server-side PIN verification via `/api/pin/verify`, implement session persistence with `@capacitor/preferences`, and handle the full auth lifecycle — including offline fallback, app resume, and error/loading states.

</domain>

<decisions>
## Implementation Decisions

### PIN Entry UI
- **D-23:** Single input field with `inputmode="numeric"` and `pattern="[0-9]*"` — triggers numeric keypad on mobile; accepts 4-6 digits
- **D-24:** Masked input (`type="password"` or CSS `-webkit-text-security: disc`) for privacy; auto-focused when PIN gate is shown
- **D-25:** Submit on Enter/Go key press — no submit button required; keyboard action triggers verification

### Session Persistence
- **D-26:** Store raw PIN (`accessPin`), `companyName`, and `tenantId` in `@capacitor/preferences` — the raw PIN is required by the server via the `x-access-pin` header for all authenticated API calls
- **D-27:** On app start: NO auto-restore of session — user must re-enter PIN (per AUTH-04 relaxation; session restore requirement dropped by user decision)
- **D-28:** `getAuthHeaders()` in `mobile/src/api.js` reads `accessPin` from Preferences and returns `{ "x-access-pin": pin }` — replaces the empty-object skeleton from Phase 2 (D-22)

### App Lifecycle (Resume / Background)
- **D-29:** On resume from background (via `App.addListener('appStateChange', ...)`): always re-show the PIN gate — user re-enters PIN to access the app
- **D-30:** No background timeout threshold — every resume triggers PIN gate (simple, consistent with no-session-restore approach)

### Offline Auth — Local PIN Verification
- **D-31:** On successful online PIN verification, store a bcrypt hash of the PIN in Preferences as `pinHash` — used for offline fallback verification
- **D-32:** On app launch: if server is unreachable, allow local PIN entry — verify against stored `pinHash` using `bcrypt.compare()` (bundled via JS bcrypt implementation; 6 salt rounds for mobile performance)
- **D-33:** Local verify only granted when server is unreachable — not as a bypass. If server is reachable and returns invalid, DO NOT fall back to local match

### Error States & User Feedback
- **D-34:** **Loading**: Full-screen spinner overlay during PIN verification (before server responds or timeout fires)
- **D-35:** **Invalid PIN**: Inline red error message below input field; input value cleared for retry
- **D-36:** **Network failure**: Retry bar at bottom of screen (reuses Phase 2 retry bar pattern from D-23/D-24)
- **D-37:** **Rate limited (429)**: Generic message "Too many attempts. Try again later." — avoids revealing rate limit details
- **D-38:** **Local verify failure (offline, PIN doesn't match cache)**: "Invalid PIN" — same message as online failure, consistent UX

### The Agent's Discretion
- Exact layout of the PIN gate screen (positioning of logo/title/input) — standard centered-card pattern follows mobile convention
- JS bcrypt implementation choice (e.g., `bcryptjs` npm package) — research will pick the most suitable
- Spinner UI style — matches existing app aesthetic
- Whether to show company name on PIN gate — can be omitted since we don't have it before auth

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Requirements
- `.planning/ROADMAP.md` §Phase 3 — Phase goal, success criteria, plan outline
- `.planning/REQUIREMENTS.md` §Authentication (AUTH-01 through AUTH-06) — Full requirements traceability

### Active Decisions from Prior Phases
- `.planning/phases/01-project-setup-toolchain/01-CONTEXT.md` — D-04 (server.url), D-09 (Preferences plugin), D-10 (App plugin for lifecycle)
- `.planning/phases/02-api-connectivity-network-layer/02-CONTEXT.md` — D-14 (apiRequest wrapper), D-17 (structured response), D-22 (getAuthHeaders skeleton), D-23/D-24 (retry bar & error patterns)

### Codebase Reference
- `mobile/src/api.js` — Existing `apiRequest()` wrapper and per-endpoint convenience functions
- `mobile/src/connectivity.js` — Network detection module (isConnected for offline auth decision)
- `mobile/src/main.js` — Health check UI patterns (retry bar, inline error states, loading spinner)
- `src/server.js:200-250` — `GET /api/pin/verify` endpoint (expected headers, response shape, rate limiting)
- `src/renderer.js:306-365` — Electron PIN login flow for reference (header construction, error handling, unlock pattern)

### Architecture & Stack
- `.planning/codebase/STACK.md` — Technology stack (Capacitor v8, vanilla JS, bcrypt on server)
- `.planning/codebase/ARCHITECTURE.md` — PIN auth flow, IPC bridge pattern, state management
- `.planning/codebase/INTEGRATIONS.md` — API endpoints, auth header conventions, rate limiting

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/api.js` — `apiRequest()` wrapper ready for auth header injection; `getAuthHeaders()` skeleton returns `{}` — Phase 3 populates it from Preferences
- `mobile/src/connectivity.js` — `isConnected()` getter used to decide online vs offline auth path
- `mobile/src/main.js` — Retry bar and inline error patterns can be reused for PIN verification error states
- `mobile/src/style.css` — Existing styles for forms, badges, and status indicators

### Established Patterns
- **fetch() + AbortController** (10s timeout) — Established in Phase 1/2 for all API calls; PIN verify call follows same pattern
- **Module-level state + subscriber pattern** — From connectivity.js; auth state (isAuthenticated, companyName) should follow same approach
- **Structured API responses** — `{ ok, data, error, status }` from D-17; PIN verify response wraps server JSON into this format

### Integration Points
- Backend `GET /api/pin/verify` — Accepts `x-access-pin` header; returns `{ valid: true, tenant_id, company_name }` or `{ valid: false, message }` on failure; 503 on DB error
- `@capacitor/preferences` — Replaces Electron's JSON-file storage for session data
- `@capacitor/app` — `appStateChange` event triggers PIN gate on resume (D-29)
- `x-access-pin` header — Required for all subsequent API calls (entries, etc.); set via `getAuthHeaders()` in api.js

</code_context>

<specifics>
## Specific Ideas

- Offline PIN verification flow mirrors the existing Electron app pattern (try server → fall back to local compare)
- User wants device-local PIN caching for offline use, not server-dependent-only auth

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-PIN Authentication & Session Management*
*Context gathered: 2026-07-08*
