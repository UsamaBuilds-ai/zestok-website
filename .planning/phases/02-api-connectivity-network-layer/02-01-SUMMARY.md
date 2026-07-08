---
phase: 02-api-connectivity-network-layer
plan: 01
subsystem: api-connectivity
tags: ["android", "network-security", "api-client", "cleartext"]
requires:
  - phase: 01-project-setup-toolchain
    provides: Android project scaffold, cleartext-enabled manifest, health check UI
provides:
  - Targeted Android network security config restricting cleartext to API server only
  - Centralized API service layer with timeout, error normalization, and auth header skeleton
  - Refactored main.js delegating health check to api.js module
affects:
  - Phase 03 (auth) will populate getAuthHeaders() from Preferences
  - All subsequent phases will use apiRequest() for server communication

tech-stack:
  added: []
  patterns:
    - Centralized apiRequest() wrapper with AbortController timeout, structured {ok, data, error, status} responses
    - Per-endpoint convenience functions delegating to shared apiRequest()
    - Android network_security_config.xml for domain-specific cleartext policy

key-files:
  created:
    - mobile/android/app/src/main/res/xml/network_security_config.xml
    - mobile/src/api.js
  modified:
    - mobile/android/app/src/main/AndroidManifest.xml
    - mobile/src/main.js

key-decisions:
  - "network_security_config.xml uses domain-config for 84.235.249.239 with cleartextPermitted, base-config blocks all other cleartext"
  - "D-14: Single apiRequest() wrapper centralizing all fetch logic"
  - "D-15: API_BASE = http://84.235.249.239:3000/api (includes /api prefix)"
  - "D-16: AbortController timeout defaulting to 10s, overridable per-call"
  - "D-17: Structured response {ok, data, error, status} for all paths"
  - "D-18: Per-endpoint convenience functions getHealth(), getEntries(), verifyPin()"
  - "D-22: getAuthHeaders() skeleton returns {} — Phase 3 populates from Preferences"

requirements-completed: [CONN-01]

duration: 2min
completed: 2026-07-08
status: complete
---

# Phase 2: Plan 1 Summary

**Android network security config restricting cleartext to the API server only + centralized apiRequest() wrapper with timeout, error normalization, and per-endpoint convenience functions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-08T16:33:36Z
- **Completed:** 2026-07-08T16:35:56Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created `network_security_config.xml` allowing cleartext only to `84.235.249.239` with a cleartext-blocked base-config for all other domains
- Updated `AndroidManifest.xml` with `android:networkSecurityConfig="@xml/network_security_config"` while keeping `usesCleartextTraffic="true"` as fallback
- Implemented centralized `apiRequest()` wrapper with 10s AbortController timeout, structured responses, and auth header injection skeleton (D-14 through D-18, D-22)
- Created per-endpoint convenience functions: `getHealth()`, `getEntries()`, `verifyPin()`
- Refactored `main.js` to import and use `getHealth()` from the new API module, removing duplicate constants and inline fetch logic
- Verified Vite build succeeds with the new module imports (3 modules transformed, 298ms)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create network_security_config.xml and update AndroidManifest.xml** - `20deed9` (feat)
2. **Task 2: Create centralized API service module (api.js)** - `c2d5c82` (feat)
3. **Task 3: Update main.js to use the new API service layer** - `756ec07` (refactor)

## Files Created/Modified

- `mobile/android/app/src/main/res/xml/network_security_config.xml` - Android network security policy restricting cleartext to the known API server only
- `mobile/android/app/src/main/AndroidManifest.xml` - Updated with `android:networkSecurityConfig` reference
- `mobile/src/api.js` - Centralized API service layer with `apiRequest()`, `getAuthHeaders()`, `getHealth()`, `getEntries()`, `verifyPin()`
- `mobile/src/main.js` - Refactored to delegate health check to `api.js`; removed duplicate `API_BASE` constant and inline `AbortController`

## Decisions Made

- **D-14:** Single `apiRequest()` wrapper — all fetch logic centralized in one function
- **D-15:** `API_BASE` set to `http://84.235.249.239:3000/api` (includes `/api` prefix matching server route structure)
- **D-16:** `AbortController` with 10s default timeout, overridable per-call via `options.timeout`
- **D-17:** Structured response `{ ok, data, error, status }` — network errors return `{ ok: false, error: 'network_error', status: 0 }`, HTTP errors return `{ ok: false, error: 'server_error', status }`
- **D-18:** Per-endpoint convenience functions: `getHealth()`, `getEntries()`, `verifyPin()`
- **D-22:** `apiRequest()` accepts `options.auth` flag; when truthy, injects headers from `getAuthHeaders()`. Phase 2 returns `{}` — Phase 3 populates via Preferences
- `usesCleartextTraffic="true"` kept as fallback on `<application>` element — `network_security_config.xml` provides domain-specific restrictions on top

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check Verification

- [x] `network_security_config.xml` exists with domain-config for `84.235.249.239` and cleartext-blocked base-config
- [x] `AndroidManifest.xml` has `android:networkSecurityConfig="@xml/network_security_config"`
- [x] `api.js` exists with `apiRequest()`, `getAuthHeaders()`, `getHealth()`, `getEntries()`, `verifyPin()`
- [x] `main.js` imports and uses `getHealth` from `api.js`
- [x] Vite build succeeds (5 modules transformed, 298ms)
- [x] All D-14 through D-18 and D-22 decisions verified in api.js
- [x] No files outside `mobile/` were modified

**Result:** PASSED

## Issues Encountered

None.

## Next Phase Readiness

- Android cleartext HTTP is now properly scoped to the specific API server via `network_security_config.xml`
- Centralized API service layer ready for Phase 3 auth integration — `getAuthHeaders()` skeleton awaits Preferences population
- All subsequent API consumers should use `import { apiRequest } from './api.js'` pattern
- Ready for Plan 02-02 (connectivity detection module)

---

*Phase: 02-api-connectivity-network-layer*
*Completed: 2026-07-08*
