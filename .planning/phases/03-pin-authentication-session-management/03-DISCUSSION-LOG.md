# Phase 3: PIN Authentication & Session Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 3-pin-authentication-session-management
**Areas discussed:** Offline auth, Session persistence, PIN Entry UI, App lifecycle, Error states

---

## Offline Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Cache & verify locally | Store verified PIN hash in Preferences. On server unreachable, allow PIN entry and verify locally against cache. Matches Electron app behavior. | ✓ |
| Server-only auth | Always require server connectivity. If server is unreachable, show error. Simpler — no local PIN storage, always fresh verification. | |

**User's choice:** Cache & verify locally
**Notes:** User confirmed they want offline fallback matching the Electron app pattern.

---

## Local Cache Content

| Option | Description | Selected |
|--------|-------------|----------|
| Store raw PIN | Simpler — store the actual PIN entered. Verify by sending to server when online, or re-use the raw PIN for local check. | |
| Store bcrypt hash | More secure — hash the PIN with bcrypt before storing. | ✓ |

**User's choice:** Store bcrypt hash
**Notes:** User wants bcrypt hash for local verification. Follow-up revealed conflict with session restore requirement (raw PIN needed for API calls).

---

## Session Restore Conflict

| Option | Description | Selected |
|--------|-------------|----------|
| Store raw PIN + hash | Store both raw PIN (for API) and bcrypt hash (for local verify) | |
| Encrypted PIN | Encrypt PIN with device key before storing | |
| Prompt on restore | Accept re-entering PIN on app restart. Drop session restore requirement (AUTH-04). | ✓ |
| You decide | Let agent decide | |

**User's choice:** Prompt on restore
**Notes:** User chose to accept PIN re-entry on app restart, relaxing the AUTH-04 session restore requirement. The raw PIN is still stored in Preferences after successful online verification so that `getAuthHeaders()` can supply it for subsequent API calls during the same session — but on full app restart, the PIN gate is shown again.

---

## Agent's Discretion

The following areas were marked "let the agent decide" by the user and were not directly discussed:

- **PIN Entry UI**: Single numeric input, masked, auto-focused — standard mobile pattern
- **Session persistence**: Store raw PIN + company_name + tenant_id in Preferences for API auth
- **App lifecycle**: Re-show PIN gate on every resume from background
- **Error states**: Spinner, inline error, retry bar, rate limit message

## Deferred Ideas

None carried forward — biometric unlock moved to Phase 4 scope.
