# Stock Management

## What This Is

A stock/inventory management system with a Windows desktop app (Electron) for data entry and reports, plus an Android mobile app (Capacitor/Ionic) for viewing stock data. Data is stored in PostgreSQL for unified access across devices.

## Core Value

Users can track stock inventory on their desktop and view real-time stock availability (item, category, quantity, rate) on their Android phone.

## Requirements

### Validated

- ✓ Desktop stock entry (in/out) — existing
- ✓ Desktop stock balance dashboard with search — existing
- ✓ Desktop transaction reports with CSV/PDF export — existing
- ✓ Express API server (port 3000) — existing
- ✓ PIN-based API authentication — existing (hardcoded mock)

### Active

- [ ] **DB-01**: PostgreSQL database with stock entries table
- [ ] **DB-02**: PostgreSQL setup instructions (Windows)
- [ ] **SVR-01**: Express API serves real PostgreSQL data (not mock)
- [ ] **SVR-02**: Express API returns stock grouped by category with balance calculation
- [ ] **SVR-03**: Express API returns only available items (qty > 0)
- [ ] **PIN-01**: Desktop has a PIN configuration page to set/manage the mobile access PIN
- [ ] **PIN-02**: API uses the configurable PIN for auth (not hardcoded)
- [ ] **MOB-01**: Android APK via Capacitor/Ionic
- [ ] **MOB-02**: Mobile app shows stock list grouped by category
- [ ] **MOB-03**: Mobile app has search bar for items
- [ ] **MOB-04**: Mobile app only shows items with available stock (qty > 0)
- [ ] **MOB-05**: Mobile app displays item name, category, total qty, new rate
- [ ] **MOB-06**: Mobile app has PIN entry screen on launch
- [ ] **MOB-07**: Desktop-to-mobile data sync via Express API

### Out of Scope

- Play Store distribution — direct APK file only
- Mobile stock entry (in/out) — view-only for v1
- Multi-user authentication — single PIN shared across devices
- Offline support — requires network connection to the desktop API

## Context

- Current desktop app uses JSON file storage (`stock-data.json`)
- Express server exists with mock data for prototyping
- No PostgreSQL setup exists yet
- Target Android devices are on the same local network as the desktop

## Constraints

- **Compatibility**: Desktop must continue working during migration
- **Network**: Mobile APK connects to desktop IP on local network
- **Authentication**: Single PIN shared among mobile users
- **Build**: APK generated locally, no CI/CD required
- **Windows**: Desktop runs on Windows only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Capacitor/Ionic | Reuses web skills, wraps to APK easily | — Pending |
| Desktop sets PIN | Admin controls access centrally | — Pending |
| Both use PostgreSQL | Single source of truth, no sync issues | — Pending |
| View-only mobile | Simpler MVP, reduces attack surface | — Pending |
| Direct APK | No Play Store account needed | — Pending |

---

*Last updated: 2026-06-24 after initialization*
