# Requirements: Stock Management

**Defined:** 2026-06-24
**Core Value:** Users can track stock inventory on their desktop and view real-time stock availability (item, category, quantity, rate) on their Android phone.

## v1 Requirements

### Database

- [ ] **DB-01**: PostgreSQL 16+ installed and configured on Windows
- [ ] **DB-02**: Database schema with `stock_entries` table matching entry model
- [ ] **DB-03**: Database schema with `app_settings` table (PIN, config)
- [ ] **DB-04**: Stock balance view (computed from entries)
- [ ] **DB-05**: JSON file data migrated to PostgreSQL

### Express API

- [ ] **API-01**: Express connects to PostgreSQL with connection pool
- [ ] **API-02**: `GET /api/stock` returns stock balance grouped by category
- [ ] **API-03**: `GET /api/stock` returns only available items (balance > 0)
- [ ] **API-04**: `GET /api/pin/verify` verifies PIN from request header
- [ ] **API-05**: `GET /api/pin/status` returns whether PIN is configured
- [ ] **API-06**: API returns category information with each item

### Desktop App

- [ ] **DKT-01**: Desktop reads stock data from PostgreSQL instead of JSON
- [ ] **DKT-02**: Desktop writes stock entries to PostgreSQL
- [ ] **DKT-03**: Desktop PIN settings page (set/change access PIN)
- [ ] **DKT-04**: Desktop displays local IP address for mobile connection
- [ ] **DKT-05**: Express server auto-starts with desktop app

### Mobile APK

- [ ] **MOB-01**: Capacitor project initialized in `mobile/` directory
- [ ] **MOB-02**: PIN entry screen on app launch
- [ ] **MOB-03**: Stock list screen grouped by category headers
- [ ] **MOB-04**: Search bar to filter items by name
- [ ] **MOB-05**: Each item shows name, category, total qty, new rate
- [ ] **MOB-06**: Only available items displayed (qty > 0)
- [ ] **MOB-07**: Configurable server IP address
- [ ] **MOB-08**: Auto-refresh on app foreground
- [ ] **MOB-09**: Error state when server unreachable
- [ ] **MOB-10**: APK generated and signed for distribution

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

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| DB-05 | Phase 1 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| API-04 | Phase 1 | Pending |
| API-05 | Phase 1 | Pending |
| API-06 | Phase 1 | Pending |
| DKT-01 | Phase 2 | Pending |
| DKT-02 | Phase 2 | Pending |
| DKT-03 | Phase 2 | Pending |
| DKT-04 | Phase 2 | Pending |
| DKT-05 | Phase 2 | Pending |
| MOB-01 | Phase 3 | Pending |
| MOB-02 | Phase 3 | Pending |
| MOB-03 | Phase 3 | Pending |
| MOB-04 | Phase 3 | Pending |
| MOB-05 | Phase 3 | Pending |
| MOB-06 | Phase 3 | Pending |
| MOB-07 | Phase 3 | Pending |
| MOB-08 | Phase 3 | Pending |
| MOB-09 | Phase 3 | Pending |
| MOB-10 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓
- Phase 1: DB-01–05, API-01–06 (11 reqs)
- Phase 2: DKT-01–05 (5 reqs)
- Phase 3: MOB-01–10 (10 reqs)

---

*Requirements defined: 2026-06-24*
*Last updated: 2026-06-24 after initial definition*
