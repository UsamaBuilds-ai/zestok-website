---
phase: 05-quick-rate-check-navigation-shell
plan: 01
subsystem: ui
tags: bottom-nav, tab-switching, settings, sign-out, capacitor

requires:
  - phase: 04-dashboard-metrics-stock-table
    provides: dashboard.js (formatRate, formatQty, getBalancesState), main.js (onAuthChange pattern), auth.js (signOut stub)
provides:
  - Bottom navigation bar with 3 fixed tabs (Dashboard, Rate Check, Settings)
  - Tab switching with header text update (preserving network badge DOM node)
  - Settings screen (company name, server health, app version 1.0.0)
  - Sign-out flow clearing accessPin + biometricEnabled, preserving pinHash + cachedEntries
  - Rate Check placeholder view
affects: []

tech-stack:
  added: []
  patterns:
    - "switchTab() view-switching pattern with classList.toggle for .hidden + .nav-tab.active"
    - "Settings view uses cloneNode() pattern for idempotent button listener wiring"
    - "Header tab name via textContent on isolated span (preserves network badge DOM node)"

key-files:
  created:
    - mobile/src/settings.js
  modified:
    - mobile/index.html
    - mobile/src/style.css
    - mobile/src/dashboard.js
    - mobile/src/auth.js
    - mobile/src/main.js

key-decisions:
  - "Header tab name rendered via textContent on #header-tab-name span (not innerHTML on header) to preserve network badge DOM node per RESEARCH.md Pitfall 5"
  - "Settings sign-out button uses cloneNode(true) pattern each showSettings() to avoid stale listener accumulation"
  - "signOut() preserves pinHash (offline re-entry) and cachedEntries (offline data) per D-57"

patterns-established:
  - "View switching: switchTab() hides all views via classList, shows target, updates header text, updates nav active state, calls view-specific show function"
  - "Settings health check: showSettings() triggers updateHealthStatus() which checks connectivity first, then fetches /api/health with loading spinner"

requirements-completed:
  - UI-01
  - UI-03
  - UI-04

duration: 5min
completed: 2026-07-09
status: complete
---

# Phase 5 Plan 1: Quick Rate Check — Navigation Shell Summary

**Bottom nav bar with 3 tabs (Dashboard, Rate Check, Settings), tab switching with header text update, Settings screen with company/health/version/sign-out, and sign-out flow that returns to PIN gate**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-09T13:57:00Z
- **Completed:** 2026-07-09T14:02:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Bottom navigation bar with 3 fixed tabs (Dashboard, Rate Check, Settings) added to index.html
- Tab switching via switchTab() function: hides all views, shows target, updates header text, highlights active tab
- Header tab name on isolated #header-tab-name span (textContent, not innerHTML) — network badge DOM node preserved
- Settings screen with company name (from session), server health (live /api/health check with spinner), app version "1.0.0"
- Sign-out button clears accessPin + biometricEnabled, preserves pinHash + cachedEntries, triggers PIN gate via onAuthChange
- Rate Check tab shows placeholder text "Rate Check coming soon" (full content in Plan 2)
- Dashboard exports: formatRate, formatQty, getBalancesState now exported from dashboard.js
- signOut() function added to auth.js for use by sign-out button and future consumers
- CSS: shared view sections (#dashboard-view, #ratecheck-view, #settings-view), bottom nav (.nav-tab), settings screen, spinner-sm
- z-index hierarchy maintained: retry-bar(100) > bottom-nav(90)

## Task Commits

Each task was committed atomically:

1. **Task 1: Navigation shell — bottom nav HTML/CSS, tab switching, header update, dashboard exports, auth signOut** - `045708e` (feat)
2. **Task 2: Settings screen implementation + tab switching in main.js + sign-out wiring** - `44002db` (feat)

## Files Created/Modified
- `mobile/index.html` — Added #header-tab-name span, #ratecheck-view, #settings-view, #bottom-nav with 3 .nav-tab buttons
- `mobile/src/style.css` — Shared view sections CSS (.hidden toggle), bottom nav CSS (.nav-tab, .nav-icon, .nav-label), settings CSS (.settings-list, .settings-item, .settings-signout-btn, .spinner-sm animation)
- `mobile/src/dashboard.js` — Exported formatRate, formatQty, getBalancesState
- `mobile/src/auth.js` — Added signOut() function (clears accessPin + biometricEnabled, preserves pinHash + cachedEntries)
- `mobile/src/main.js` — Added imports (signOut, showSettings/hideSettings, formatRate/formatQty/getBalancesState), switchTab() function, bottom nav wiring, updated onAuthChange to use switchTab + showPinGate on sign-out
- `mobile/src/settings.js` — Created with showSettings(), hideSettings(), updateHealthStatus(), APP_VERSION = '1.0.0'

## Decisions Made
- Header tab name rendered via textContent on #header-tab-name span (not innerHTML on header) to preserve network badge DOM node per RESEARCH.md Pitfall 5
- Settings sign-out button uses cloneNode + fresh addEventListener each showSettings() to avoid stale listener accumulation
- signOut() preserves pinHash (offline PIN re-entry) and cachedEntries (offline data) per D-57/D-58

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Navigation shell complete, ready for Plan 2 (Rate Check implementation)
- Rate Check tab shows placeholder — full content wired in Plan 2
- Dashboard tab continues to work via existing showDashboard()
- Settings screen fully functional with health check and sign-out

## Self-Check: PASSED

All created files verified on disk and commit hashes confirmed in git log.

---
*Phase: 05-quick-rate-check-navigation-shell*
*Completed: 2026-07-09*