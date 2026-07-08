# Summary: Offline Fallback + Complete Error States

**Plan:** 03-03 (Wave 3)
**Status:** Complete

## Tasks

- [x] **Task 01** — Update `auth.js`: extract `_verifyOffline(pin)` helper using `bcrypt.compareSync`, 429 → `rate_limited`, network error catch → fall through to offline path, add `handleSessionExpiry()`, `checkSessionTimeout()`
- [x] **Task 02** — Update `main.js` + `style.css`: rate-limit 5s countdown timer, shake animation on invalid PIN (0.4s), session expired pill banner (5s auto-dismiss), session timeout check on resume via `checkSessionTimeout()`

## Files Modified
- `mobile/src/auth.js` — added offline fallback, rate-limit handling, session expiry helpers
- `mobile/src/main.js` — added rate-limit countdown, shake trigger, session expiry banner, session timeout check on resume

## Decisions Applied
- D-31: bcrypt hash stored for offline fallback
- D-32: Offline verify uses bcrypt.compareSync()
- D-33: 429 rate-limit blocks input for 5s with countdown, no exponential backoff
- D-34: Network error silently falls through to offline verify
- D-35: Session timeout pill banner (5s auto-dismiss)
- D-36: 401 triggers clearSession() + re-show PIN gate
- D-37: Online-invalid and offline-invalid both return 'invalid_pin' — no distinguishing
- D-38: Error transitions with fade-out

## Phase 3 Complete
All three waves implemented. PIN authentication, session persistence, app lifecycle handling, offline fallback, and error state management are operational.
