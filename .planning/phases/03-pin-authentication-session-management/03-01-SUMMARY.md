# Summary: PIN Gate UI + Core Verification

**Plan:** 03-01 (Wave 1)
**Status:** Complete

## Tasks

- [x] **Task 01** — Create `mobile/src/auth.js`: module-level auth state, subscriber pattern, `verifyPin()` calling GET /pin/verify, session storage in Preferences + bcrypt hash, `clearSession()`
- [x] **Task 02** — Update `mobile/src/api.js`: `verifyPin()` changed from POST to GET (no body), `getAuthHeaders()` made async (reads from Preferences), apiRequest() awaits auth headers
- [x] **Task 03** — Add PIN gate overlay HTML/CSS, spinner overlay, auth bootstrap in `main.js` (show gate on init, hide on success, inline error on failure)

## Files Modified
- `mobile/src/auth.js` — created
- `mobile/src/api.js` — updated
- `mobile/src/main.js` — updated
- `mobile/index.html` — updated
- `mobile/src/style.css` — updated
- `mobile/package.json` — added bcryptjs dependency

## Decisions Applied
- D-23: PIN input numeric 4-6 digits
- D-24: PIN input masked (type="password")
- D-25: PIN input auto-focuses on gate show
- D-26: Session stored in Preferences (accessPin, companyName, tenantId)
- D-28: getAuthHeaders() reads from Preferences
- D-31: bcrypt hash (6 rounds) stored as pinHash

## Remaining for Wave 2
- appStateChange listener for resume re-auth
- Re-show PIN gate on resume

## Remaining for Wave 3
- Offline bcrypt verification fallback
- Rate-limit 5s countdown timer
- Network error → offline fallthrough
- 401 session expiry → clearSession + re-show gate
- Shake animation on invalid PIN
