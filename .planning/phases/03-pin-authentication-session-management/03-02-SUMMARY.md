# Summary: Session Persistence + App Lifecycle

**Plan:** 03-02 (Wave 2)
**Status:** Complete

## Tasks

- [x] **Task 01** — Session persistence (pre-wired in Wave 1): Preferences.set for accessPin, companyName, tenantId, pinHash on successful verify; Preferences.remove for all four in clearSession()
- [x] **Task 02** — App lifecycle: `App.addListener('appStateChange', ...)` registered in init, re-shows PIN gate on every resume (`isActive === true`)

## Files Modified
- `mobile/src/main.js` — added App import and appStateChange listener

## Decisions Applied
- D-26: Session persisted in Preferences
- D-27: NO auto-restore on start (PIN gate always shown)
- D-28: getAuthHeaders() reads from Preferences
- D-29: Resume re-authenticates via appStateChange
- D-30: No background timeout threshold — every resume triggers PIN re-entry
- D-31: bcrypt hash stored for offline fallback

## Remaining for Wave 3
- Offline bcrypt verification fallback in auth.js
- Rate-limit 5s countdown timer in main.js
- Network error → offline fallthrough
- 401 session expiry → clearSession + re-show gate
- Shake animation on invalid PIN
- Session expired pill banner
