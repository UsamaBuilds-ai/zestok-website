# Phase 2: API Connectivity & Network Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 02-API Connectivity & Network Layer
**Areas discussed:** API Service Layer, Network Detection, Auth Header Strategy, Error Handling UX

---

## API Service Layer

| Option | Description | Selected |
|--------|-------------|----------|
| Single apiRequest() | Centralized wrapper with timeout, error normalization, auth injection | ✓ |
| Per-endpoint modules | Individual functions for each API endpoint without shared wrapper | |

**User's choice:** Agent decide
**Notes:** User delegated all gray area decisions to the agent. Selected single apiRequest() with per-endpoint convenience functions — balances centralized control with clean caller code.

---

## Network Detection

| Option | Description | Selected |
|--------|-------------|----------|
| @capacitor/network plugin | Native Android connectivity API with real-time status change events | ✓ |
| Fetch-based ping | Periodic health check to determine connectivity without native plugin | |

**User's choice:** Agent decide
**Notes:** @capacitor/network chosen for native reliability — provides both current status snapshot and real-time change listeners. Browser dev fallback uses navigator.onLine.

---

## Auth Header Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Interceptor in apiRequest() | Headers injected centrally via getAuthHeaders() function | ✓ |
| Manual per-call | Each endpoint function manages its own auth headers | |

**User's choice:** Agent decide
**Notes:** Interceptor pattern chosen — apiRequest() checks options.auth flag and injects headers automatically. Skeleton for Phase 3: getAuthHeaders() returns {} for now.

---

## Error Handling UX

| Option | Description | Selected |
|--------|-------------|----------|
| Structured error objects + retry | apiRequest returns {ok, data, error, status}; transient→bottom bar, persistent→inline error | ✓ |
| Toast notifications | Global toast for all errors without per-screen state | |

**User's choice:** Agent decide
**Notes:** Structured error objects chosen — gives UI components flexibility to choose their error display strategy. Retry bar pattern from Phase 1 health check reused.

---

## the agent's Discretion

- Android network_security_config.xml details — standard cleartext traffic domain configuration
- Notification/toast style for transient errors — standard bottom retry bar
- File organization in mobile/src/ — api.js for service layer, connectivity.js for network detection

## Deferred Ideas

None — discussion stayed within phase scope.
