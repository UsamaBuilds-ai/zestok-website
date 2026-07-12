# Roadmap: Stock Management Mobile Companion

**Created:** 2026-07-07
**Granularity:** Standard (6 phases)
**Total requirements:** 23

---

### Phase 1: Project Setup & Toolchain ✓

**Goal:** Install missing Capacitor packages, verify toolchain requirements (Node 22+, Android Studio Otter+, SDK 36), and initialize the Capacitor Android project.
**Mode:** mvp

**Success Criteria:**

1. ✓ `@capacitor/core`, `@capacitor/cli`, `@capacitor/preferences`, `@capacitor/app` installed at matching versions in mobile/package.json
2. ✓ `capacitor.config.ts` created with correct configuration (D-01 through D-11)
3. ✓ `npx cap add android` succeeds — Android project scaffolded at mobile/android/
4. ✓ App launches on emulator/device showing health check UI with connection status
5. ✓ Node.js 22+, Android Studio Otter+ confirmed working
6. ✓ Walking Skeleton: SKELETON.md produced with architectural decisions

**Plans:** 2/2 complete ✓

Plans:

- [x] 01-01-PLAN.md — Project scaffold: create mobile/ directory, install Capacitor packages, configure Vite + Capacitor with all Phase 1 decisions (D-01 through D-11)
- [x] 01-02-PLAN.md — Health check app & Android launch: build health check UI, initialize Android platform, verify toolchain and emulator launch

---

### Phase 2: API Connectivity & Network Layer ✓

**Goal:** Configure Android cleartext HTTP, implement the API service layer, and verify connectivity to the backend server.
**Mode:** mvp

**Success Criteria:**

1. ✓ `androidScheme: 'http'` and `cleartext: true` configured — app connects to `http://84.235.249.239:3000`
2. ✓ `network_security_config.xml` created allowing cleartext to the API server
3. ✓ Centralized `apiRequest()` function implemented with auth header injection skeleton
4. ✓ `@capacitor/network` installed — app detects online/offline status
5. ✓ App can successfully call `/api/health` and display server status

**Plans:** 2/2 plans complete

Plans:

- [x] 02-01-PLAN.md — Configure cleartext HTTP for Android + API service layer: network_security_config.xml, apiRequest() wrapper, getAuthHeaders() skeleton
- [x] 02-02-PLAN.md — Network connectivity detection: @capacitor/network, connectivity.js, retry bar, inline error states

---

### Phase 3: PIN Authentication & Session Management

**Goal:** Build the PIN entry screen, wire up server-side PIN verification, implement session persistence, and handle auth lifecycle.
**Mode:** mvp

**Success Criteria:**

1. PIN entry screen displayed on app launch (4-6 digit numeric input)
2. PIN sent to `/api/pin/verify` with `x-access-pin` header
3. Valid PIN hides gate — invalid PIN shows error message
4. Session (PIN + company name) persisted in `@capacitor/preferences`
5. App restores session on relaunch without re-entering PIN
6. Loading spinner shown during verification — error states handled

**Plans:**

- Build PIN entry UI (HTML/CSS)
- Implement AuthService module
- Wire up session persistence with Preferences
- Handle app lifecycle (resume, re-auth)
- Handle error states (network failure, invalid PIN)

---

### Phase 4: Dashboard — Metrics & Stock Table

**Goal:** Build the main dashboard with metric cards and scrollable stock balance table with search.
**Mode:** mvp

**Success Criteria:**

1. 4 metric cards display accurate counts (Total Items, Balance Qty, Stock Value, Today's Movement)
2. Stock balance table renders with all 7 columns — scrollable vertically
3. Search bar filters stock table by item name/category in real-time
4. Data fetched from `/api/entries` on dashboard open
5. Offline: last-known-good data shown with "stale data" indicator
6. Mobile-optimized layout (single-column, 44px+ touch targets, safe-area)
7. Biometric unlock (fingerprint/face) available on resume as alternative to PIN re-entry

**Plans:** 4 plans

Plans:

- [ ] 04-01-PLAN.md — Dashboard foundation: create dashboard.js, balances.js, update index.html/main.js/style.css with dashboard view and 4 metric cards
- [ ] 04-02-PLAN.md — Stock balance table + search: add renderStockTable(), real-time 300ms debounce search filter, touch-optimized table CSS
- [ ] 04-03-PLAN.md — Offline cache: cache entries in Preferences, read cache on failure, stale-data banner with 5s auto-dismiss
- [ ] 04-04-PLAN.md — Biometric unlock: install @aparajita/capacitor-biometric-auth, implement biometric-first resume flow with PIN fallback

> **Status:** Plans created. Ready for execution.

---

### Phase 5: Quick Rate Check & Navigation Shell

**Goal:** Build the rate check screen and complete the app with bottom navigation and settings.
**Mode:** mvp

**Success Criteria:**

1. Rate check screen: item name input with autocomplete suggestions
2. Displays latest rate and current balance for selected item
3. Bottom navigation bar with Dashboard, Rate Check, and Settings tabs
4. Settings screen shows app version, server status, sign-out button
5. Sign-out clears session and returns to PIN gate

**Plans:** 2 plans

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Navigation shell + Settings + Sign-out: bottom nav HTML/CSS, tab switching, header updates, Settings screen (company/health/version/sign-out), signOut() in auth.js, PIN gate return on sign-out

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Rate Check screen: autocomplete input with 300ms debounce, dropdown suggestions, rate (Rs) and balance (qty) result cards

---

### Phase 6: Polish, Signing & Release ✓

**Goal:** Configure app icon, splash screen, generate keystore, sign APK, and verify installation on Android 11+.
**Mode:** mvp

**Success Criteria:**

1. ✓ Custom app icon displayed on home screen
2. ✓ Splash screen shown during app load
3. ✓ Keystore generated with `keytool` and backed up securely
4. ✓ Signed APK built with `signingType: 'apksigner'`
5. ⚡ APK signature verified (v2+v3) — `adb install` requires device connection
6. ✓ Release build produced with apksigner v2/v3 signing scheme

**Plans:** 2/2 complete ✓

**Wave 1**

- [x] 06-01-PLAN.md — Branded app icon ("SM" vector on #1a1a2e) + splash screen ("Stock Management" text) with launchAutoHide

**Wave 2** *(depends on Wave 1 — file conflict on capacitor.config.ts)*

- [x] 06-02-PLAN.md — Keystore generation + Gradle signing config + signed APK build + adb install verification + RELEASE.md documentation

---

**Coverage:**

- v1 requirements: 23
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Roadmap created: 2026-07-07*
