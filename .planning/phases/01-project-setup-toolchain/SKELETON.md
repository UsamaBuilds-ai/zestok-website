# Walking Skeleton — Zestok Mobile Companion

**Phase:** 1 — Project Setup & Toolchain
**Generated:** 2026-07-07

## Capability Proven End-to-End

> A user opens the app and sees whether the backend server is reachable.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Mobile framework | Capacitor 8.4 | Already in deps (`@capacitor/android@^8.4.1`); reuses the developer's vanilla JS skills from the Electron app; read-only dashboards don't need native performance |
| Frontend stack | Vanilla JS + Vite 6.1 | The mobile companion is 6 thin screens (PIN entry, dashboard, stock table, rate check, settings). Vanilla JS + Vite keeps bundle ~50KB vs 200KB+ for framework overhead. The developer is already productive in vanilla JS from the Electron project. Frameworks add zero value for this scope. |
| Project layout | `mobile/` subdirectory | Separate from Electron `src/`; clean separation without workspace tooling overhead. Capacitor config, Vite config, and Android project all live under `mobile/`. |
| App identity | `com.zestok.mobile` / "Zestok" | D-01, D-02: reverse-domain convention matching project; desktop branding consistency on home screen |
| Backend URL | `http://84.235.249.239:3000` | D-04: matches existing Electron app's server config; HTTP not HTTPS (cleartext required) |
| HTTP client | CapacitorHttp (bundled in `@capacitor/core`) | Native Android HTTP (OkHttp) bypasses browser CORS; bundled with core — no separate install; full timeout control |
| Local storage | `@capacitor/preferences` | Maps to Android SharedPreferences — explicitly preserved by OS unlike WebView localStorage which can be evicted under memory pressure |
| App lifecycle | `@capacitor/app` | Resume/background events for session refresh; back button handling (see Phase 3) |
| Build tooling | Vite (zero-config for vanilla JS) | Fast HMR, Capacitor community standard, minimal config |
| Android cleartext | `server.cleartext: true` + `server.androidScheme: 'http'` | D-05: configured in `capacitor.config.ts`; Capacitor auto-generates `android:usesCleartextTraffic="true"` in AndroidManifest.xml; `network_security_config.xml` deferred to Phase 2 for domain-specific rules |
| Web directory | `dist/` | D-06: standard Vite output directory; matches Capacitor convention |
| Android SDK | API 36 (Android 16), Build-Tools 36.x | Required by Capacitor 8 and Android Studio Otter 2025.2.1+ |
| Project directory | `.planning/phases/01-project-setup-toolchain/` | Standard GSD phase artifact location |

## Stack Touched in Phase 1

- [x] **Project scaffold** — `mobile/` directory, `package.json` with all Capacitor deps, `.gitignore`
- [x] **Build tooling** — Vite 6 configured with vanilla JS, clean `dist/` output
- [x] **Capacitor config** — `capacitor.config.ts` with app identity, server, and plugin settings (D-01 through D-11)
- [x] **Entry point** — `index.html` with mobile viewport, theme-color, safe-area handling
- [x] **API call** — Health check to `http://84.235.249.239:3000/api/health` using CapacitorHttp/fetch
- [x] **UI interaction** — Connection status indicator (green/red/gray) with Retry button
- [x] **Android project** — Generated via `npx cap add android`, cleartext config applied
- [x] **Dev deployment** — App launched on emulator/device, health check UI renders

## What Each Phase Builds on This Skeleton

| Phase | Adds | Depends On |
|---|---|---|
| 2 — API Connectivity & Network Layer | `network_security_config.xml`, API service layer, network plugin, connectivity detection | Skeleton + Android project |
| 3 — PIN Auth & Session Management | PIN entry UI, AuthService, Preferences-backed session, app lifecycle handlers | Phase 2 API layer |
| 4 — Dashboard — Metrics & Stock Table | Metric cards, stock balance table, search, offline cache | Phase 3 auth + Phase 2 API |
| 5 — Quick Rate Check & Navigation | Rate check screen, bottom nav bar, settings, sign-out | Phase 4 dashboard |
| 6 — Polish, Signing & Release | App icon, splash screen, keystore, signed APK | All prior phases |

## Out of Scope (Deferred to Later Slices)

- PIN authentication and session management (Phase 3)
- Dashboard metrics, stock table, and search (Phase 4)
- Network connectivity detection (Phase 2 — `@capacitor/network`)
- Granular `network_security_config.xml` for domain-specific cleartext rules (Phase 2)
- Offline caching with stale-data indicator (Phase 4)
- Bottom navigation shell (Phase 5)
- Rate check with autocomplete (Phase 5)
- Settings screen and sign-out (Phase 5)
- App icon, splash screen, and keystore (Phase 6)
- Any modifications to existing Electron `src/` files — mobile app is entirely separate

## Decisions Locked for Future Phases

These architectural decisions from Phase 1 are **locked** — future phases build on them, they do not renegotiate them:

1. `appId: "com.zestok.mobile"` — used for all future Android manifest references
2. `webDir: "dist"` — all Vite builds output to `mobile/dist/`; `npx cap sync` copies from there
3. `server.url: "http://84.235.249.239:3000"` — all API calls use this base URL
4. `server.cleartext: true` — cleartext HTTP is enabled; Phase 2 adds domain-specific config
5. CapacitorHttp enabled — future API code uses fetch (patched by CapacitorHttp on Android)
6. Project structure — all mobile source lives under `mobile/`; `src/` remains Electron-only
7. All D-XX decisions from CONTEXT.md are locked and carried forward

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2:** API Connectivity & Network Layer — configure cleartext HTTP, implement API service layer with auth header injection skeleton, add `@capacitor/network` for connectivity detection, verify `CapacitorHttp` works end-to-end
- **Phase 3:** PIN Authentication & Session Management — PIN entry screen, server-side verification via `POST /api/pin/verify`, session persistence in Preferences, app resume handling
- **Phase 4:** Dashboard — 4 metric cards from `/api/entries`, scrollable stock balance table with search, PKR currency formatting, offline cache with stale indicator
- **Phase 5:** Quick Rate Check & Navigation Shell — rate check screen with autocomplete, bottom navigation, settings, sign-out flow
- **Phase 6:** Polish, Signing & Release — app icon, splash screen, keystore generation, signed APK with apksigner

---

*Skeleton established: 2026-07-07*
*Next: Execute Phase 2 — API Connectivity & Network Layer*
