# Phase 2: API Connectivity & Network Layer - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the API service layer with centralized request handling, configure cleartext HTTP for Android, add native network connectivity detection via @capacitor/network, and verify the app can communicate with the backend server reliably — handling online, offline, and error states appropriately.

</domain>

<decisions>
## Implementation Decisions

### API Service Layer (D-14 through D-18)
- **D-14:** Single `apiRequest()` wrapper function — centralized fetch wrapper in `mobile/src/api.js` handling base URL, timeout, error normalization, and auth header injection skeleton
- **D-15:** `API_BASE` constant set to `http://84.235.249.239:3000` (mirrors `src/config.js` pattern from Electron app)
- **D-16:** Timeout via `AbortController` with 10-second default, overridable per-call
- **D-17:** Structured response format — `{ ok, data, error, status }` for all API calls; network errors return `{ ok: false, error: "network_error" }`, HTTP errors return `{ ok: false, error: "server_error", status }`
- **D-18:** Per-endpoint convenience functions (`api.getHealth()`, `api.getEntries()`, etc.) that call `apiRequest()` internally — keeps callers clean while maintaining centralized control

### Network Connectivity Detection (D-19 through D-21)
- **D-19:** Use `@capacitor/network` plugin for native connectivity detection — provides `getStatus()` for current state and `addListener('networkStatusChange', ...)` for real-time changes
- **D-20:** A `connectivity` module (`mobile/src/connectivity.js`) that wraps the plugin — exposes `isConnected()` getter, `onStatusChange(callback)` subscription, and a global `navigator.onLine` fallback for browser dev
- **D-21:** Network status stored in a simple reactive state (module-level variable + subscriber pattern) so UI components can show/hide offline indicators without prop drilling

### Auth Header Strategy (D-22)
- **D-22:** `apiRequest()` accepts optional `options.auth` parameter — when truthy, injects `x-access-pin` and `x-device-token` headers from a `getAuthHeaders()` function. For Phase 2, `getAuthHeaders()` returns `{}` (empty — no auth yet). Phase 3 will populate it from Preferences.

### Error Handling & UX (D-23 through D-25)
- **D-23:** Transient errors (timeout, network flake) show a retry bar at the bottom of the screen — follows the same pattern as Phase 1 health check retry button
- **D-24:** Persistent errors (server down) show inline error state with a "Retry" action
- **D-25:** All API errors are logged to `console.error` with enough context to debug — no silent failures

### the agent's Discretion
- Android `network_security_config.xml` format — standard XML pattern for cleartext traffic domains
- Notification/toast style for transient errors — standard bottom bar with "Retry" text
- Exact file organization inside `mobile/src/` — single `api.js` module with named exports, `connectivity.js` for network detection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Context
- `.planning/phases/02-api-connectivity-network-layer/02-CONTEXT.md` — This file (decisions captured above)
- `.planning/ROADMAP.md` §Phase 2 — Phase goal, success criteria, plan outline
- `.planning/REQUIREMENTS.md` §CONN-01, CONN-02 — Phase 2 requirements traceability

### Phase 1 Context (Active Decisions)
- `.planning/phases/01-project-setup-toolchain/01-CONTEXT.md` — D-01 through D-13 (cleartext, manifest, server config)
- `mobile/capacitor.config.ts` — App identity, server.cleartext, plugin configuration
- `mobile/android/app/src/main/AndroidManifest.xml` — usesCleartextTraffic, INTERNET permission

### Codebase Reference
- `src/config.js` — API_URL pattern (`http://84.235.249.239:3000`) to mirror
- `src/server.js` — Backend API endpoint definitions (health, pin, entries)
- `src/renderer.js` — Reference for API call patterns, error handling, retry logic

### Architecture & Stack
- `.planning/codebase/STACK.md` — Technology stack (Capacitor v8, vanilla JS)
- `.planning/codebase/ARCHITECTURE.md` — System architecture, data flow patterns
- `.planning/codebase/INTEGRATIONS.md` — API endpoints, auth header convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/main.js` — Existing `checkHealth()` function with fetch + AbortController pattern; will be refactored into the centralized apiRequest
- `src/config.js` — `API_URL = "http://84.235.249.239:3000"` — establishes the base URL convention
- `src/renderer.js` — Error handling patterns (try server → fallback local, retry buttons)

### Established Patterns
- **fetch() + AbortController** — Already used in Phase 1 health check; proven pattern for Capacitor apps
- **CapacitorHttp patching** — `@capacitor/core` patches fetch to use native OkHttp on Android, bypassing CORS
- **Module-level state** — Simple module-scoped variables + getters for shared state (fits the app's vanilla JS approach)

### Integration Points
- Backend at `http://84.235.249.239:3000/api` — health, entries, pin/verify endpoints (all already exist server-side)
- `@capacitor/network` plugin — connects to native Android connectivity API for real-time status changes
- Auth header pattern — existing Electron app uses `x-access-pin` and `x-device-token` headers; apiRequest skeleton must support same convention

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for API service layer and connectivity detection.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-API Connectivity & Network Layer*
*Context gathered: 2026-07-08*
