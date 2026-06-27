# Stock Management

## What This Is

A stock/inventory management system with a Windows desktop app (Electron) for data entry and reports, plus an Android mobile app (Capacitor/Ionic) for viewing stock data. Data is stored in PostgreSQL for unified access across devices.

## Core Value

Users can track stock inventory on their desktop and view real-time stock availability (item, category, quantity, rate) on their Android phone.

## Requirements

### Validated

- ✓ PostgreSQL schema with stock_entries + app_settings tables — existing
- ✓ Stock balance view (computed from entries) — existing
- ✓ Express API with PG connection pool — existing
- ✓ GET /api/stock returns grouped by category, only available items — existing
- ✓ GET /api/pin/verify with bcrypt + rate limiting — existing
- ✓ GET /api/pin/status endpoint — existing
- ✓ JSON data migrated to PostgreSQL — existing
- ✓ Mobile Capacitor project scaffold — existing
- ✓ Mobile PIN entry screen (numeric keypad, shake animation, lockout) — existing
- ✓ Mobile stock list grouped by category with search — existing
- ✓ Mobile pull-to-refresh — existing
- ✓ Mobile error states (server unreachable, wrong PIN) — existing
- ✓ Mobile APK build with keystore — existing
- ✓ Mobile barcode scanner plugin configured — existing

### Active

- [ ] **DKT-01**: Desktop reads stock data from PostgreSQL (JSON fallback)
- [ ] **DKT-02**: Desktop saves new stock entries to PostgreSQL
- [ ] **DKT-04**: Desktop displays local IP address for mobile connection
- [ ] **DKT-05**: Express server auto-starts with desktop app
- [ ] **DKT-06**: Desktop generates QR code in footer (click shows server IP QR)
- [ ] **DKT-03**: Desktop PIN settings page (set/change access PIN)
- [ ] **MOB-01–10**: End-to-end verification of mobile app with live API
- [ ] **DEP-01**: Private GitHub repository created
- [ ] **DEP-02**: Desktop auto-update via GitHub Releases
- [ ] **DEP-03**: Mobile APK distributed via GitHub Releases

### Out of Scope

- Play Store distribution — direct APK file only
- Mobile stock entry (in/out) — view-only for v1
- Multi-user authentication — single PIN shared across devices
- Offline support — requires network connection to desktop API
- iOS support — Android-only for v1

## Context

- Current desktop app uses JSON file storage (`stock-data.json`)
- Express server uses real PostgreSQL queries (not mock data)
- Mobile app built with Capacitor/Ionic — APK signed and ready
- Mobile has QR scanning via barcode-scanner plugin
- Target Android devices are on same local network as desktop

## Constraints

- **Compatibility**: Desktop must continue working during migration
- **Network**: Mobile APK connects to desktop IP on local network
- **Authentication**: Single PIN shared among mobile users
- **Build**: APK generated locally, no CI/CD required
- **Windows**: Desktop runs on Windows only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Capacitor/Ionic | Reuses web skills, wraps to APK easily | ✓ Good |
| Desktop sets PIN | Admin controls access centrally | — Pending |
| Both use PostgreSQL | Single source of truth, no sync issues | ✓ Good |
| View-only mobile | Simpler MVP, reduces attack surface | ✓ Good |
| Direct APK | No Play Store account needed | ✓ Good |
| QR code in footer | Mobile scans server IP for zero-config setup | — Pending |
| GitHub private repo | Version control + auto-update delivery | — Pending |
| electron-updater | Auto-update desktop via GitHub Releases | — Pending |

---

*Last updated: 2026-06-27 after roadmap restructure*
