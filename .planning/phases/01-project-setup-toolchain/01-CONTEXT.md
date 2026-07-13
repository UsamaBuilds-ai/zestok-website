# Phase 1: Project Setup & Toolchain - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Install missing Capacitor packages, configure Capacitor with app identity and plugins, initialize the Android platform, and verify the full toolchain (Node 22+, Android Studio Otter+, SDK 36) produces a launchable app on emulator or device.

</domain>

<decisions>
## Implementation Decisions

### App Identity
- **D-01:** appId set to `com.zestok.mobile` — follows reverse-domain convention matching the project name
- **D-02:** appName set to `"Zestok"` — matches desktop branding for clarity on mobile home screen
- **D-03:** UIDisplayName inherits from appName

### Capacitor Configuration
- **D-04:** `server.url` configured in `capacitor.config.ts` pointing to `http://84.235.249.239:3000`
- **D-05:** `server.cleartext` set to `true` — required because the backend uses HTTP (not HTTPS)
- **D-06:** `webDir` set to `"dist"` — standard Capacitor convention for built web assets

### Plugins
- **D-07:** Configure SplashScreen plugin in capacitor.config.ts — auto-hide delay, backgroundColor matching app theme
- **D-08:** Configure StatusBar plugin — style, backgroundColor for app theme
- **D-09:** Configure Preferences plugin — needed for session persistence (Phase 3+)
- **D-10:** Configure App plugin — lifecycle event handling (resume, background)
- **D-11:** Configure Network plugin — connectivity detection (Phase 2+)

### Android Manifest
- **D-12:** `android:usesCleartextTraffic="true"` on `<application>` — required for HTTP backend
- **D-13:** `INTERNET` permission declared — required for all network calls

### the agent's Discretion
- Android SDK targeting details (compileSdk, targetSdk, minSdk) — use SDK 36 as specified in phase goal
- Initial app content on first launch — Capacitor default web content is sufficient for toolchain verification
- Android `network_security_config.xml` details — follow standard cleartext traffic pattern
- Build tooling scripts (package.json scripts for capacitor commands)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Project overview, core value, constraints
- `.planning/REQUIREMENTS.md` — Full requirements traceability
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria

### Codebase Reference
- `package.json` — Existing dependencies including `@capacitor/android` ^8.4.1
- `src/config.js` — Existing API URL configuration pattern
- `src/server.js` — Backend API structure for reference

### Architecture & Stack
- `.planning/codebase/STACK.md` — Current technology stack analysis
- `.planning/codebase/ARCHITECTURE.md` — System architecture reference
- `.planning/codebase/INTEGRATIONS.md` — API integration patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` — Already lists `@capacitor/android` ^8.4.1 as a dependency; needs additional Capacitor packages installed
- `src/config.js` — API URL pattern (`API_URL = "http://84.235.249.239:3000"`) that the mobile app should mirror

### Established Patterns
- **Single-page app** — The Electron renderer uses a single HTML file with JS-driven views; mobile app will follow a similar pattern
- **HTTP client** — The existing app uses `fetch()` directly for API calls; Capacitor's webview can use the same approach

### Integration Points
- Backend server at `http://84.235.249.239:3000` provides all required API endpoints
- Capacitor's `@capacitor/preferences` will replace Electron's JSON-file storage for mobile session persistence
- `@capacitor/network` provides connectivity detection (replaces any Electron-based network checks)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard Capacitor setup approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Project Setup & Toolchain*
*Context gathered: 2026-07-07*
