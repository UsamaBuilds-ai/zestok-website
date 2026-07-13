# Requirements: Zestok Mobile Companion

**Defined:** 2026-07-07
**Core Value:** Users can check current stock data from their phone at any time without needing access to the desktop app.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User enters 4-6 digit PIN on app launch
- [ ] **AUTH-02**: App validates PIN against server `/api/pin/verify`
- [ ] **AUTH-03**: Valid PIN unlocks dashboard — invalid PIN shows error
- [ ] **AUTH-04**: Session persists across app restarts (Preferences-backed)
- [ ] **AUTH-05**: App re-authenticates on resume from background if session expired
- [ ] **AUTH-06**: App shows loading state during PIN verification

### Dashboard — Metrics

- [ ] **DASH-01**: Dashboard shows 4 metric cards: Total Items, Balance Qty, Stock Value, Today's Movement
- [ ] **DASH-02**: Values formatted with PKR currency (Rs) and comma separators
- [ ] **DASH-03**: Dashboard auto-refreshes data on app open

### Dashboard — Stock Balance Table

- [ ] **DASH-04**: Scrollable stock balance table with columns: Item, Category, In, Out, Balance, Rate, Value
- [ ] **DASH-05**: Search/filter bar to filter items by name or category
- [ ] **DASH-06**: Empty state when no data available

### Dashboard — Rate Check

- [ ] **DASH-07**: Rate check screen with item name input field
- [ ] **DASH-08**: Autocomplete suggestions while typing item name
- [ ] **DASH-09**: Displays latest rate and current balance for selected item

### Connectivity & Reliability

- [ ] **CONN-01**: App works with HTTP backend (cleartext configured for Android 9+)
- [ ] **CONN-02**: App shows error state when server is unreachable
- [ ] **CONN-03**: Last-known-good data cached and displayed when offline (stale indicator)

### Navigation & UI

- [ ] **UI-01**: Bottom navigation bar with Dashboard, Rate Check, and Settings tabs
- [ ] **UI-02**: Touch-friendly UI with 44px+ touch targets, single-column layout
- [ ] **UI-03**: App displays app version and build info in Settings
- [ ] **UI-04**: Sign-out option in Settings (clears session)

### Release

- [ ] **REL-01**: Signed APK produced that installs on Android 11+
- [ ] **REL-02**: App has custom icon and splash screen
- [ ] **REL-03**: Keystore backed up securely

## v2 Requirements

### Enhancements

- **UX-01**: Pull-to-refresh on dashboard
- **UX-02**: Dark/high-contrast theme for outdoor warehouse use
- **UX-03**: Server health indicator in header
- **UX-04**: Biometric unlock (fingerprint/face)
- **UX-05**: Homescreen widget showing key metrics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Stock Entry/Edit forms | Read-only app by design |
| Transaction reports & CSV/PDF export | Desktop app handles this; mobile screen too small |
| Push notifications | Requires server-side FCM setup — out of scope |
| Real-time WebSocket updates | Overkill for read-only; auto-refresh suffices |
| Multi-language/i18n | Premature for target audience |
| Landscape/tablet layout | Testing surface doubles for limited benefit |
| iOS version | Android-only for v1 |
| Server-side changes | All API endpoints already exist |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| AUTH-05 | Phase 3 | Pending |
| AUTH-06 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| DASH-05 | Phase 4 | Pending |
| DASH-06 | Phase 4 | Pending |
| DASH-07 | Phase 5 | Pending |
| DASH-08 | Phase 5 | Pending |
| DASH-09 | Phase 5 | Pending |
| CONN-01 | Phase 2 | Pending |
| CONN-02 | Phase 2 | Pending |
| CONN-03 | Phase 4 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 5 | Pending |
| UX-04 | Phase 4 | Pending |
| REL-01 | Phase 6 | Pending |
| REL-02 | Phase 1/6 | Pending |
| REL-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after initial definition*
