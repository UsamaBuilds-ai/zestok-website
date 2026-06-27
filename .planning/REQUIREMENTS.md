# Requirements: Stock Management

**Defined:** 2026-06-24
**Core Value:** Users can track stock inventory on their desktop and view real-time stock availability (item, category, quantity, rate) on their Android phone.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Validated (Completed in earlier phases)

- ✓ **DB-01**: PostgreSQL 16+ installed and configured on Windows
- ✓ **DB-02**: Database schema with `stock_entries` table matching entry model
- ✓ **DB-03**: Database schema with `app_settings` table (PIN, config)
- ✓ **DB-04**: Stock balance view (computed from entries)
- ✓ **DB-05**: JSON file data migrated to PostgreSQL
- ✓ **API-01**: Express connects to PostgreSQL with connection pool
- ✓ **API-02**: `GET /api/stock` returns stock balance grouped by category
- ✓ **API-03**: `GET /api/stock` returns only available items (balance > 0)
- ✓ **API-04**: `GET /api/pin/verify` verifies PIN from request header
- ✓ **API-05**: `GET /api/pin/status` returns whether PIN is configured
- ✓ **API-06**: API returns category information with each item
- ✓ **MOB-01**: Capacitor project initialized in `mobile/` directory
- ✓ **MOB-02**: PIN entry screen on app launch
- ✓ **MOB-03**: Stock list screen grouped by category headers
- ✓ **MOB-04**: Search bar to filter items by name
- ✓ **MOB-05**: Each item shows name, category, total qty, new rate
- ✓ **MOB-06**: Only available items displayed (qty > 0)
- ✓ **MOB-07**: Configurable server IP address
- ✓ **MOB-08**: Auto-refresh on app foreground
- ✓ **MOB-09**: Error state when server unreachable
- ✓ **MOB-10**: APK generated and signed for distribution

### Phase 1: Web App Completion

- [ ] **DKT-01**: Desktop reads stock data from PostgreSQL instead of JSON
- [ ] **DKT-02**: Desktop writes stock entries to PostgreSQL
- [ ] **DKT-04**: Desktop displays local IP address for mobile connection
- [ ] **DKT-05**: Express server auto-starts with desktop app
- [ ] **DKT-06**: Desktop generates QR code of server IP in footer (click to show)

### Phase 2: PIN Settings Window

- [ ] **DKT-03**: Desktop PIN settings page (set/change access PIN)

### Phase 3: Mobile Application

- [ ] **MOB-01–10**: End-to-end verification of mobile app with live API

### Phase 4: GitHub Deploy + Auto-Updates

- [ ] **DEP-01**: Private GitHub repository created and code pushed
- [ ] **DEP-02**: Desktop auto-update via GitHub Releases (electron-updater)
- [ ] **DEP-03**: Mobile APK distributed via GitHub Releases

## v2 Requirements

- **MOB-11**: Mobile stock entry (in/out)
- **MOB-12**: Biometric/PIN authentication via Capacitor plugin
- **MOB-13**: Push-to-refresh gesture
- **MOB-14**: Dark mode

## Out of Scope

| Feature | Reason |
|---------|--------|
| Play Store distribution | Direct APK only for v1 |
| Multi-user auth | Single PIN shared among mobile users |
| Offline mode | Requires network to API at all times |
| iOS support | Android-only for v1 |
| Mobile stock entry | View-only for v1 — deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01–05, API-01–06 | Completed earlier | Complete ✓ |
| MOB-01–10 | Completed earlier | Complete ✓ |
| DKT-01, DKT-02, DKT-04, DKT-05, DKT-06 | Phase 1 | Pending |
| DKT-03 | Phase 2 | Pending |
| MOB-01–10 (verification) | Phase 3 | Pending |
| DEP-01, DEP-02, DEP-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Validated: 17
- Active (mapped to phases): 11
- Unmapped: 0 ✓
- Phase 1: 5 reqs
- Phase 2: 1 req
- Phase 3: 1 req (verification)
- Phase 4: 3 reqs

---

*Requirements defined: 2026-06-24*
*Last updated: 2026-06-27 after roadmap restructure*
