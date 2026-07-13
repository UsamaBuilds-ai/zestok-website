# Project Research Summary

**Project:** Zestok — Mobile Companion (Android)
**Domain:** PIN-authenticated read-only Android companion app for Zestok desktop system
**Researched:** 2026-07-07
**Confidence:** HIGH (stack, architecture, pitfalls) / MEDIUM (features)

## Executive Summary

This project is a Capacitor v8-based Android companion app that pairs with an existing Zestok Electron desktop system. It provides warehouse managers and stock controllers with read-only access to key metrics (total items, balance quantities, stock value, daily movement) and a quick rate-check feature from their mobile devices. The app follows a PIN-authenticated, single-page application (SPA) pattern using vanilla JavaScript — deliberately avoiding framework overhead (React, Vue, etc.) since the mobile interface comprises only 6 thin screens.

The recommended approach is a Capacitor 8 + Vite + vanilla JS architecture, reusing the backend API (`http://84.235.249.239:3000`) already serving the desktop app. This keeps the bundle small (~200KB web assets + ~5MB Android shell), avoids a framework learning curve for the developer (who is experienced with vanilla JS from the Electron project), and delivers core value through PIN auth, a 4-card metric dashboard, a scrollable stock balance table with search, and a quick rate-check screen. Session persistence uses `@capacitor/preferences` (Android SharedPreferences) rather than localStorage, which can be evicted by the OS on mobile.

Three critical risks dominate the research. **First**, the project has `@capacitor/android` installed but is missing `@capacitor/core`, `@capacitor/cli`, `@capacitor/preferences`, and `@capacitor/app` — the app will not function without these. **Second**, Android 9+ blocks cleartext HTTP by default, and the backend uses plain HTTP; the app will silently fail with `ERR_CLEARTEXT_NOT_PERMITTED` unless `androidScheme: 'http'` and `cleartext: true` are configured in `capacitor.config.ts` AND a `network_security_config.xml` is created in the Android project. **Third**, the APK signing tool defaults to `jarsigner`, which produces V1 signatures rejected on Android 11+; the `signingType: 'apksigner'` option must be explicitly set. The keystore itself is irreplaceable — loss means the app can never be updated.

## Key Findings

### Recommended Stack

The core technology decisions are straightforward: Capacitor 8 as the mobile bridge (already in dependencies), Node.js 22 LTS+ (required by Capacitor 8), Android Studio Otter 2025.2.1+ (required for AGP 8.13.0 compatibility), Vite ^6 as the web bundler, and vanilla JS/HTML/CSS for the UI layer.

**Critical package gap identified:** The project's `package.json` only contains `@capacitor/android@^8.4.1`. The following must be installed before any Capacitor commands will work:
- `@capacitor/core@^8.4.1` — core JS runtime (includes CapacitorHttp)
- `@capacitor/cli@^8.4.1` — CLI for cap init, add, sync, build
- `@capacitor/preferences@^8.0.0` — persistent key/value storage (SharedPreferences on Android)
- `@capacitor/app@^8.0.0` — app lifecycle events, back button handling

**Why vanilla JS over a framework:** The mobile companion is 6 thin screens (PIN entry, dashboard, stock table, rate check, settings). Vanilla JS + Vite keeps the bundle ~50KB vs 200KB+ for framework overhead. The developer is already productive with vanilla JS from the Electron app. Frameworks add zero value for this scope.

**Key version requirements:**
- Node.js 22 LTS+ (Capacitor 8 will not work on Node 20 or below)
- Android Studio Otter 2025.2.1+ (older versions cause AGP conflicts)
- Android SDK Platform API 36 (Android 16), Build-Tools 36.x
- JDK 21 is bundled with Android Studio Otter — no separate install needed

### Expected Features

**Must-have (P0 — table stakes):**
- PIN entry screen with server verification — nothing works without auth
- 4 metric cards (Total Items, Balance Qty, Stock Value, Today's Movement) — core value prop
- Stock balance table with search/filter — the primary reason users open the app
- Quick rate check with item autocomplete — key quick-access need
- Auto-refresh on app open — users expect fresh data
- Loading and error states for all API calls

**Should-have (P1-P2 — differentiators worth the effort):**
- Session persistence across restarts (Preferences-backed) — users won't re-enter PIN constantly
- Bottom navigation (Dashboard / Rate Check tabs) — standard mobile UX
- Dark/high-contrast theme — outdoor readability in warehouses
- Pull-to-refresh — high UX value for moderate effort
- Offline-cached last-seen data with stale-data indicator — critical for flaky mobile connectivity
- Server health indicator — useful for troubleshooting
- Biometric unlock (P3) — friction reduction, moderate effort

**Defer to v2+:**
- Homescreen widget (high complexity, platform-fragile)
- Push notifications (requires server-side FCM setup, out of scope)
- Full transaction reports (desktop handles this; mobile screen too small)
- Landscape/tablet layout (testing surface doubles for limited benefit)
- Multi-language/i18n (premature for target audience)
- Stock In/Out entry forms (project explicitly states read-only)
- Real-time WebSocket updates (overkill for read-only; auto-refresh suffices)

### Architecture Approach

The architecture follows a simple SPA pattern with view switching (no router needed for 2 screens). The Android WebView loads a mobile-specific `index.html` containing a PIN Gate view and a Dashboard view. An **Auth Service** module handles PIN verification, session persistence via `@capacitor/preferences`, and token management. A centralized **API Service Layer** injects auth headers (`x-access-pin`, `x-device-token`) automatically and handles common error states (401 → redirect to PIN, 5xx → retry, offline → cached data). An in-memory **State Store** holds the current session PIN and entries cache.

**Major components:**
1. **PIN Gate View** — Splash animation, 4-6 digit PIN entry form. Communicates with Auth Service.
2. **Auth Service** — PIN validation against `/api/pin/verify`, session persistence in Preferences, re-auth on app resume.
3. **Dashboard Views** — Metric cards, stock balance table, rate check. All depend on `/api/entries`.
4. **API Service Layer** — All REST calls with automatic auth header injection, 401 handling, error normalization.
5. **Preferences Plugin** — Persistent storage for auth tokens, PIN hash, company name. Native SharedPreferences on Android.
6. **Network Plugin** — Connectivity detection before API calls, enables offline fallback.

**Key architectural patterns:**
- **SPA with class-based view switching** (same pattern as Electron `renderer.js`)
- **Centralized API service** with auth header injection and automatic 401 → PIN gate redirect
- **Preferences-backed session persistence** (NOT localStorage — OS can evict WebView storage)
- **Mobile-first CSS** with 44px touch targets, single-column layout, safe-area handling
- **Network-aware data loading** — check connectivity before API calls, serve cached data when offline
- **CapacitorHttp** (built into `@capacitor/core`) for native HTTP requests that bypass browser CORS

### Critical Pitfalls

1. **Cleartext HTTP blocked on Android 9+ (Critical).** The backend uses `http://` — Android blocks cleartext by default. The app silently fails with `ERR_CLEARTEXT_NOT_PERMITTED`. **Prevention:** Set `androidScheme: 'http'` and `cleartext: true` in `capacitor.config.ts`, create `network_security_config.xml`, and always run `npx cap sync android` after config changes.

2. **jarsigner vs apksigner — wrong signing tool for APK (Critical).** Capacitor defaults to `jarsigner`, which creates V1 signatures rejected on Android 11+. **Prevention:** Always set `signingType: 'apksigner'` for APK builds. Never use `apksigner` for AAB files. Test install with `adb install` on Android 11+.

3. **Keystore loss is irreversible (Critical).** Losing the keystore file or password means the app can never be updated. **Prevention:** Generate keystore with `keytool`, back up to password manager + encrypted cloud + offline drive, use environment variables for passwords, `.gitignore` the `.jks` file.

4. **Missing core packages (Critical).** Only `@capacitor/android` is installed. Missing `@capacitor/core`, `@capacitor/cli`, `@capacitor/preferences`, `@capacitor/app`. **Prevention:** Install all missing packages at matching `^8.x` versions before any Capacitor command.

5. **LocalStorage eviction on mobile (Moderate).** The Electron app uses localStorage, but Android WebView can clear localStorage under memory pressure. **Prevention:** Always use `@capacitor/preferences` for auth tokens and session data — it maps to Android SharedPreferences which is explicitly preserved by the OS.

6. **Live reload destroys server config (Moderate).** `npx cap run android -l` replaces `capacitor.config.json`'s `server` object, wiping `androidScheme`, `cleartext`, and `allowNavigation`. **Prevention:** Avoid live reload during API testing; always re-run `npx cap sync android` after using live reload.

## Implications for Roadmap

Based on combined research, the project should be structured into 6 sequential phases. The ordering follows strict dependency chains: the environment must work before any code runs, auth must work before any data displays, and signing is the final gate before users can install.

### Phase 1: Project Setup & Toolchain Verification
**Rationale:** Everything depends on a working development environment. Capacitor 8 has hard version requirements (Node 22+, Android Studio Otter+, AGP 8.13.0, API 36) and missing core packages must be installed before any Capacitor CLI commands work. This phase prevents "Gradle sync failed" and "missing classes" debugging sessions.
**Delivers:** Working `npx cap add android`, project synced to Android Studio, app runs on emulator/device showing default Capacitor splash.
**Addresses:** Foundation for all features.
**Avoids:** Pitfalls 6 (AGP/Gradle version mismatch), 14 (AGP upgrade false alarm), 5 (plugin version mismatch).
**Research flag:** Well-documented patterns — skip research-phase. Follow STACK.md sections 1-5 exactly.
**Key steps:** Install missing packages (`@capacitor/core`, `@capacitor/cli`, `@capacitor/preferences`, `@capacitor/app`), verify Node 22+, install Android Studio Otter + SDK 36, run `npx cap init` and `npx cap add android`, verify the app launches on a device/emulator.

### Phase 2: API Connectivity & Network Layer
**Rationale:** Auth and dashboard features depend on API calls. Android's cleartext blocking (Pitfall 3) must be addressed before any real API integration — otherwise, every feature phase will silently fail with network errors. This phase establishes the API service layer, HTTP configuration, and connectivity detection as a reusable foundation.
**Delivers:** Working `CapacitorHttp` calls from the app to the backend (`http://84.235.249.239:3000`), network connectivity detection, and a `network_security_config.xml` that allows cleartext to the specific server IP.
**Addresses:** Foundation for auth (Phase 3), dashboard (Phase 4), rate check (Phase 5). Implements the API Service Layer component from ARCHITECTURE.md.
**Avoids:** Pitfall 3 (cleartext blocked), Pitfall 7 (forgetting `npx cap sync`), Pitfall 11 (SSL handshake if HTTPS is added later).
**Research flag:** Standard Capacitor/Android pattern — skip research-phase. Follow STACK.md "HTTP Requests" section and ARCHITECTURE.md "API Service with Auth Header Injection" pattern.
**Key steps:** Configure `androidScheme: 'http'` and `cleartext: true` in `capacitor.config.ts`, create `network_security_config.xml`, wire up `CapacitorHttp` plugin, implement the centralized `apiRequest()` function with auth header injection skeleton, add `@capacitor/network` for connectivity checks.

### Phase 3: PIN Authentication & Session Management
**Rationale:** The PIN gate is a mandatory prerequisite — nothing in the app is accessible without authentication. This phase delivers the auth flow end-to-end: PIN entry UI, server-side verification, session persistence, error states, and app lifecycle handling.
**Delivers:** Working PIN entry screen with server verification, session persistence across restarts via `@capacitor/preferences`, automatic re-authentication on app resume, "Forgot PIN?" handling, loading/error states, server health indicator.
**Addresses:** Features from FEATURES.md: PIN entry (P0), session persistence (P1), forgot PIN handling, loading/error states, server health indicator (P2).
**Avoids:** Pitfall 8 (back button conflict — decide strategy upfront: use `disableBackButtonHandler: true` for this simple app), localStorage eviction by using Preferences persistently.
**Research flag:** Standard auth patterns — skip research-phase. However, validate the specific API contract (`/api/pin/verify` headers, response format) against the existing backend during this phase.
**Key steps:** Build PIN entry HTML/CSS, implement `AuthService` module (verify PIN via POST, save session to Preferences, check session on launch), wire up `App.addListener('resume')` for session refresh on foreground, handle 401 responses in API service layer.

### Phase 4: Dashboard — Metrics & Stock Table
**Rationale:** The dashboard is the core value proposition. Users need to see metric cards and the stock balance table immediately after auth. This phase depends on Phase 2 (API connectivity) and Phase 3 (auth) being complete.
**Delivers:** 4 metric cards (Total Items, Balance Qty, Stock Value, Today's Movement), scrollable stock balance table with search/filter, auto-refresh on app open, empty states, currency/numeric formatting (PKR Rs with commas), pull-to-refresh (P2), offline-cached last-seen data (P2), stale-data indicator (P2).
**Addresses:** Features from FEATURES.md: metric cards (P0), stock table (P0), search (P0), auto-refresh (P0), empty states (P1), dark/high-contrast theme (P1), pull-to-refresh (P2), offline cache (P2), stale-data indicator (P2).
**Research flag:** UI design decisions could benefit from `/gsd-plan-phase --research-phase <N>` to validate the mobile-specific layout (2-column metric grid, table column choice for mobile viewport). The formatting and balance-calculation logic can be ported directly from `renderer.js` in the Electron app.
**Avoids:** Anti-pattern 1 (reusing desktop UI unchanged — write mobile-specific HTML/CSS), Anti-pattern 2 (using localStorage — use Preferences for cache).

### Phase 5: Quick Rate Check & Navigation Shell
**Rationale:** The rate check is a secondary but important feature. It depends on the same `/api/entries` data as the dashboard (already fetched in Phase 4). This phase also completes the navigation experience with bottom tab bar, header, and settings.
**Delivers:** Rate check screen with item name input, autocomplete suggestions, latest rate + balance display; bottom navigation bar (Dashboard / Rate Check tabs); settings/info screen (app version, server status, sign out).
**Addresses:** Features from FEATURES.md: rate check (P0), autocomplete (P0), bottom navigation (P1), app version display, sign-out.
**Avoids:** Anti-pattern 4 (over-engineering — keep it simple with view switching, no router needed).
**Research flag:** Standard UI patterns — skip research-phase. Rate check UI is a simple form + results display.

### Phase 6: Polish, Signing & Release
**Rationale:** APK signing and keystore management are critical gates that cannot be skipped or rushed. All features must be complete before final signing. This phase must handle the signing-tool pitfalls carefully to avoid producing a broken APK.
**Delivers:** Signed APK that installs and runs on Android 11+ devices, keystore backed up, build pipeline documented.
**Addresses:** Release readiness for all features.
**Avoids:** Pitfall 1 (keystore loss — generate + back up before signing), Pitfall 2 (jarsigner vs apksigner — explicitly set `signingType: 'apksigner'`), Pitfall 5 (plugin version mismatch — run `npm outdated` before signing), Pitfall 12 (missing ProGuard rules), Pitfall 16 (Windows-specific scripts in CI).
**Research flag:** Requires research on CI/CD build setup if automation is desired. Signing process itself is well-documented in STACK.md sections "Keystore & Signing" and "Signing Method: CLI".

### Phase Ordering Rationale

- **Strict dependency chain:** Setup (P1) → Network (P2) → Auth (P3) → Dashboard (P4) → Rate Check (P5) → Signing (P6). Each phase delivers a prerequisite for the next.
- **Auth first:** The PIN gate is the entry point for all features. Session persistence (P3) depends on Preferences (P1) and the API layer (P2).
- **Dashboard before Rate Check:** Both consume `/api/entries` data, but the dashboard is the primary use case. The rate check reuses the same data fetching and caching logic.
- **Signing last:** All features must be complete and tested before the release build. The signing pitfalls (keystore, signingType) are most safely handled as a dedicated final phase with its own checklist.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Dashboard):** UI layout decisions for mobile viewport (2-column metric grid, table column priorities on narrow screens). The balance-calculation logic from `renderer.js` can be ported directly, but the mobile layout needs design validation.
- **Phase 6 (Release):** CI/CD build setup (if automation is desired) — Windows/Linux cross-platform script compatibility needs investigation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Setup):** Well-documented Capacitor + Android setup; follow STACK.md exactly.
- **Phase 2 (API Connectivity):** Standard CapacitorHttp + network_security_config patterns.
- **Phase 3 (Auth):** Well-understood PIN auth pattern; validate API contract against backend.
- **Phase 5 (Rate Check):** Simple form + results display; standard UI pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Verified against official Capacitor v8 docs, npm registry, and Android developer docs. Version requirements are explicit and tested. |
| Features | **MEDIUM** | Derived from domain analysis of inventory management mobile apps and the existing desktop app. No user interviews conducted. P0/P1 priorities are well-grounded; P2/P3 differentiators may shift based on actual user feedback. |
| Architecture | **HIGH** | Based on proven Capacitor SPA patterns, Electron app codebase analysis (verified API contracts), and established mobile-first CSS principles. |
| Pitfalls | **HIGH** | Sourced from official Capacitor GitHub issues (#8106, #8428, #8352, #8094, etc.), community forums with confirmed workarounds, and Capawesome troubleshooting guides. All critical pitfalls have verified prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Backend API contract validation:** The research assumes `/api/pin/verify`, `/api/entries`, `/api/health`, and `/api/pin/status` endpoints exist with specific header/response patterns (based on `renderer.js` in the Electron app). These must be verified against the running backend during Phase 2/3 planning. If the API contract differs (e.g., different header names, response format), adjustments will be needed in the Auth Service and API Service Layer.
- **No offline-first beyond cached API response:** The offline strategy (stale-while-revalidate with cached `/api/entries` response) is sufficient for v1 but has no conflict resolution or background sync. This is acceptable for a read-only dashboard but should be documented as a known limitation.
- **Biometric unlock deferred:** The research identifies biometric unlock as a medium-complexity differentiator (P3) that depends on initial PIN auth. If user feedback prioritizes this, a Future phase can add it without architectural changes — the auth service already separates PIN verification from session management.
- **`@capacitor/network` not yet installed:** Required for connectivity detection in Phase 2. Must be added to dependencies during that phase.

## Sources

### Primary (HIGH confidence)
- Capacitor v8 Official Docs — Installing, Android Guide, Workflow, CLI Build, Config (capacitorjs.com/docs)
- Capacitor v8 API Docs — HTTP Plugin, Preferences Plugin, App Plugin (capacitorjs.com/docs/apis)
- Capacitor v8 Upgrade Guide — Breaking changes, version requirements (capacitorjs.com/docs/updating/8-0)
- Capacitor Android Troubleshooting — Official troubleshooting docs (capacitorjs.com/docs/android/troubleshooting)
- Android Developers — App Signing guide (developer.android.com/studio/publish/app-signing)
- npm Registry — @capacitor/android 8.4.1, @capacitor/core, @capacitor/cli (npmjs.com)
- Existing Electron app — `src/index.html`, `src/renderer.js`, `src/styles.css` (API patterns verified)

### Secondary (MEDIUM confidence)
- Capacitor GitHub Issue #8106 — Broken signed APK (jarsigner vs apksigner)
- Capacitor GitHub Issue #8428 — apksigner + AAB crash
- Capacitor GitHub Issue #8352 — Live reload destroys server config
- Capacitor GitHub Issue #8094 — Cleartext in wrong manifest
- Capawesome Android Troubleshooting Guide — Blank screen, Gradle errors, plugin issues
- Ionic Community Forum — CORS vs cleartext confusion, SSL handshake failures, missing plugin classes
- Material Design 3 Guidelines — Mobile data display patterns

### Tertiary (LOW confidence)
- Inventory management mobile app patterns (Zoho Inventory, Odoo mobile, Lightspeed) — Feature validation only
- Medium articles on Capacitor HTTP issues — Confirmed by official docs

---
*Research completed: 2026-07-07*
*Ready for roadmap: yes*
