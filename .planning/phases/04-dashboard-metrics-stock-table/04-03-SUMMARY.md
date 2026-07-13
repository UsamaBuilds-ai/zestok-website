# 04-03 SUMMARY: Offline Cache & Stale-Data Banner

## Modified
- `mobile/src/dashboard.js` — Added `Preferences` import; `CACHE_KEY`/`TS_KEY` constants; `loadDashboard()` now implements try→cache→fallback pattern (cache entries + timestamp on success, read cache on failure); `showStaleDataBanner()` (5s auto-hide), `hideStaleDataBanner()`, `showErrorMessage()` functions; `hideDashboard()` clears `_staleBannerTimer`

## Key Decisions
- D-43: Cache entries in Preferences after every successful API call
- D-44: Read cache on API failure (try server → cache → fallback)
- D-45: Stale-data banner shows "Stale data — last updated {time}" with 5s auto-hide
- D-46: Cache refreshed on every successful API call (no separate expiry)
- T-04-06 to T-04-09: All threat mitigations applied (sandboxed storage, banner + network badge dual indicators, JSON.parse try-catch)

## Acceptance
- Fresh API call → cache overwritten + banner hidden
- API failure + cache exists → cached entries displayed + stale-data banner
- API failure + no cache → inline error message
- Stale-data banner auto-hides after 5 seconds
- Wave 3 complete
