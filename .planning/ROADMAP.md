# Roadmap: Stock Management

## Phase 1: Web App Completion

**Goal:** Complete desktop Electron app — PostgreSQL read/write, auto-start Express, IP display + QR code in footer
**Mode:** mvp
**Plans:** 3 plans
**Success Criteria:**

1. Desktop loads stock data from PostgreSQL on startup (JSON fallback when PG unreachable)
2. Desktop saves new stock entries to PostgreSQL with JSON mirror
3. Express server auto-starts when desktop app launches
4. Footer displays local IP address for mobile connection
5. Footer has QR code button — click shows QR code of server IP for mobile to scan
6. Mobile can scan QR code to auto-configure server IP

Plans:

- [x] 01-01-PLAN.md — Express lifecycle management + pool integration + server status footer + JSON auto-export *(Wave 1)*
- [x] 01-02-PLAN.md — Desktop PG read/write operations with JSON fallback *(Wave 2, depends on 01-01)*
- [x] 01-03-PLAN.md — Footer IP display + QR code generation *(Wave 3, depends on 01-01, file conflict with 01-02)*

## Phase 2: PIN Settings Window

**Goal:** Desktop PIN settings modal — set/change access PIN for mobile
**Mode:** mvp
**Plans:** 1 plan
**Success Criteria:**

1. Gear icon in footer opens PIN settings modal
2. Set PIN flow: enter PIN + confirm PIN (4-6 digits)
3. Change PIN flow: enter current PIN + new PIN + confirm
4. Validation in both renderer and main process
5. Inline error messages on validation failures
6. PIN stored in PostgreSQL app_settings table

Plans:

- [ ] 02-01-PLAN.md — PIN settings modal UI + IPC handlers + PG persistence

## Phase 3: Mobile Application

**Goal:** Verify mobile app works end-to-end with the desktop API
**Mode:** mvp
**Plans:** 1 plan
**Success Criteria:**

1. Mobile app connects to desktop via IP (manual or QR scan from Phase 1)
2. PIN authentication works end-to-end with new PIN from Phase 2
3. Stock list displays correctly grouped by category
4. Search filters items by name
5. Pull-to-refresh updates stock data
6. APK builds and installs on Android device

Plans:

- [ ] 03-01-PLAN.md — End-to-end verification of mobile app with live API

## Phase 4: GitHub Deploy + Auto-Updates

**Goal:** Push to private GitHub repo, set up auto-updates for desktop and mobile
**Mode:** mvp
**Plans:** 2 plans
**Success Criteria:**

1. Private GitHub repository created on GitHub.com
2. Full project pushed to GitHub (excluding secrets, keystore, node_modules)
3. `.gitignore` properly configured for secrets and build artifacts
4. Desktop app auto-updates when new release is published (electron-updater)
5. Mobile APK distributed via GitHub Releases for download
6. Version management for tracking updates

Plans:

- [ ] 04-01-PLAN.md — GitHub private repo setup + .gitignore + push
- [ ] 04-02-PLAN.md — Desktop auto-update (electron-updater) + mobile APK release workflow
