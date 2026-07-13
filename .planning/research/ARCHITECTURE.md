# Architecture Patterns

**Domain:** Capacitor-based Android Companion App (read-only dashboard)
**Researched:** 2026-07-07
**Confidence:** HIGH

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CAPACITOR ANDROID APP                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Android WebView (System WebView)                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │              MOBILE SPA (webDir contents)                │  │   │
│  │  │                                                         │  │   │
│  │  │  ┌──────────┐   ┌───────────────┐   ┌───────────────┐  │  │   │
│  │  │  │  PIN Gate │──→│ Auth Service  │──→│   Dashboard   │  │  │   │
│  │  │  │  (View)   │   │ (JS Module)   │   │   (Views)     │  │  │   │
│  │  │  └──────────┘   └───────┬───────┘   └───────┬───────┘  │  │   │
│  │  │                          │                    │          │  │   │
│  │  │  ┌───────────────────────▼────────────────────▼──────┐  │  │   │
│  │  │  │              API Service Layer (fetch)             │  │  │   │
│  │  │  └───────────────────────▲───────────────────────────┘  │  │   │
│  │  │                          │                              │  │   │
│  │  │  ┌───────────────────────┴───────────────────────────┐  │  │   │
│  │  │  │         Capacitor Bridge (Plugin Layer)           │  │  │   │
│  │  │  │  ┌──────────────────────────────────────────┐     │  │   │   │
│  │  │  │  │ @capacitor/preferences  (auth tokens)     │     │  │   │   │
│  │  │  │  │ @capacitor/network       (connectivity)   │     │  │   │   │
│  │  │  │  │ @capacitor/splash-screen (splash)         │     │  │   │   │
│  │  │  │  └──────────────────────────────────────────┘     │  │   │   │
│  │  │  └───────────────────────────────────────────────────┘  │   │   │
│  │  │                                                         │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │ HTTP (cleartext to known IP)          │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Native Android Shell (android/)                                │   │
│  │  - AndroidManifest.xml (cleartext, permissions)                 │   │
│  │  - network_security_config.xml (allow HTTP to API server)       │   │
│  │  - Gradle build config                                          │   │
│  │  - Splash screen resources (Android 12+ splash API)             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
              ┌──────────────────────────────────────────┐
              │     Existing REST API Server              │
              │     http://84.235.249.239:3000/api        │
              │                                           │
              │  /api/pin/verify      (POST, headers)     │
              │  /api/entries         (GET, read-only)    │
              │  /api/health          (GET)               │
              │  /api/pin/status      (GET)               │
              └──────────────────────────────────────────┘
```

## Component Boundaries

| Component | Responsibility | Communicates With | Tech |
|-----------|---------------|-------------------|------|
| **PIN Gate View** | Splash animation, PIN entry form, TOTP prompt | Auth Service | HTML/CSS (mobile-first) |
| **Auth Service** | PIN validation against API, session persistence, token management | API Service, Preferences Plugin | Vanilla JS module |
| **Dashboard Views** | Metric cards, stock balance table, rate check | API Service, Auth Service | HTML/CSS/JS |
| **API Service Layer** | All REST API calls, error handling, timeout | External server (84.235.249.239:3000) | `fetch()` + error handling |
| **State Store** | In-memory app state (session PIN, entries cache) | All JS modules | Vanilla JS object |
| **Preferences Plugin** | Persist auth tokens, PIN, device token across restarts | Android SharedPreferences | `@capacitor/preferences` |
| **Splash Screen Plugin** | Show native splash on cold start | Android native | `@capacitor/splash-screen` |
| **Network Plugin** | Detect connectivity before API calls | Android connectivity API | `@capacitor/network` |
| **Android Native Shell** | WebView container, manifest, build config | Gradle build system | Kotlin/Java (auto-generated) |

### Component Dependency Graph

```
PIN Gate View ──────→ Auth Service ──────→ Preferences Plugin (persist)
     │                      │
     │                      └──────────→ API Service Layer
     │                                        │
     └──(on auth success)──→ Dashboard Views  │
                                  │           │
                                  └──────────→ API Service Layer (fetch data)
                                               │
                                               └──→ External REST Server
```

## Data Flow

### Flow 1: App Cold Start → PIN Entry → Dashboard

```
1. App launches → Android System WebView loads index.html from local assets
2. JS init() runs:
   a. Check @capacitor/preferences for stored deviceToken
   b. Call /api/pin/status to check if PIN is configured on server
   c. Show PIN Gate (splash animation → login/setup form)
3. User enters PIN → Auth Service:
   a. POST /api/pin/verify with headers { x-access-pin, x-device-token }
   b. Optional: TOTP flow if server requires it
   c. On success: store deviceToken + PIN hash in Preferences
   d. On failure: show error message, stay on PIN Gate
4. On auth success → Dashboard:
   a. GET /api/entries with auth headers
   b. Parse entries JSON → compute balances, metrics
   c. Render metric cards + stock balance table + rate check
5. App lifecycle:
   - App restarts → Preferences still has deviceToken → try silent PIN re-auth
   - If re-auth fails → show PIN Gate again
```

### Flow 2: Data Refresh (On Each App Open)

```
1. App resumes from background → App state check
2. GET /api/entries (fresh data from server)
3. Recompute metrics and balances
4. Update all views (same rendering logic as initial load)
5. If server unreachable → show cached data with "offline" indicator
```

### Flow 3: Error States

```
API call fails → Network plugin check:
  ├── No network → Show offline banner, serve cached data if available
  ├── Server error (5xx) → Show "Server error" toast, retry button
  └── Auth error (401/403) → Clear stored token, redirect to PIN Gate
```

## File Structure

```
stock-management/
├── capacitor.config.ts          # Capacitor configuration
├── mobile/                      # Web assets directory (webDir)
│   ├── index.html               # SPA shell (single page)
│   ├── css/
│   │   └── app.css              # Mobile-optimized styles
│   ├── js/
│   │   ├── app.js               # Init, state, app lifecycle
│   │   ├── auth.js              # PIN/TOTP auth service
│   │   ├── api.js               # REST API service layer
│   │   └── dashboard.js         # Dashboard rendering logic
│   ├── assets/
│   │   └── icon.png             # App icon
│   └── manifest.json            # (optional) PWA manifest
├── android/                     # Native Android project (auto-generated)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── res/
│   │   └── build.gradle
│   └── ...
├── package.json                 # @capacitor/android already listed
└── node_modules/
```

## Patterns to Follow

### Pattern 1: SPA with View Switching (No Router)
**What:** Use class-based view show/hide (same proven pattern as existing Electron `renderer.js`), but without a framework. The app has 2 screens: PIN Gate and Dashboard — no URL routing needed.

**When:** Apps with < 5 screens and no deep-linking requirements. This app only has 2 views.

**Why:** Simplest possible approach for a first mobile project. Avoids framework overhead, bundle size, and learning curve.

```javascript
// app.js — View Manager
const views = {
  pinGate: document.getElementById('pinGate'),
  dashboard: document.getElementById('dashboard')
};

function showView(name) {
  Object.keys(views).forEach(key => {
    views[key].classList.toggle('hidden', key !== name);
  });
}

// Usage: showView('pinGate') or showView('dashboard')
```

### Pattern 2: API Service with Auth Header Injection
**What:** Centralize all `fetch()` calls in a single module that automatically injects auth headers and handles common errors.

**When:** Any app that authenticates against a REST API.

**Why:** Avoids duplicating auth header logic across calls. Single place to handle 401 → redirect to login.

```javascript
// api.js — API Service Layer
const API_BASE = 'http://84.235.249.239:3000/api';

async function apiRequest(path, options = {}) {
  const deviceToken = await getStoredToken();      // from Preferences
  const pin = getCurrentPin();                      // from in-memory state

  const headers = {
    'Content-Type': 'application/json',
    ...(pin && { 'x-access-pin': pin }),
    ...(deviceToken && { 'x-device-token': deviceToken }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await clearAuth();                              // clear Preferences
    showView('pinGate');                            // redirect to PIN
    throw new Error('Session expired');
  }

  return response.json();
}

// Usage
const entries = await apiRequest('/entries');
const status  = await apiRequest('/pin/status');
```

### Pattern 3: Preferences-Backed Session Persistence
**What:** Store auth tokens and session data using `@capacitor/preferences` (native SharedPreferences on Android), not `localStorage`.

**When:** Any data that must survive app close/restart.

**Why:** `localStorage` is transient on mobile — OS can reclaim it under memory pressure. Preferences API uses native storage that persists reliably.

```javascript
// auth.js — Session Persistence
import { Preferences } from '@capacitor/preferences';

const KEYS = {
  DEVICE_TOKEN: 'deviceToken',
  PIN_HASH: 'pinHash',
  COMPANY_NAME: 'companyName',
};

export async function saveSession({ deviceToken, pin, companyName }) {
  await Preferences.set({ key: KEYS.DEVICE_TOKEN, value: deviceToken });
  await Preferences.set({ key: KEYS.PIN_HASH, value: btoa(pin) }); // basic obfuscation
  await Preferences.set({ key: KEYS.COMPANY_NAME, value: companyName });
}

export async function getSession() {
  const deviceToken = (await Preferences.get({ key: KEYS.DEVICE_TOKEN })).value;
  const companyName = (await Preferences.get({ key: KEYS.COMPANY_NAME })).value;
  return { deviceToken, companyName };
}

export async function clearSession() {
  await Preferences.remove({ key: KEYS.DEVICE_TOKEN });
  await Preferences.remove({ key: KEYS.PIN_HASH });
  await Preferences.remove({ key: KEYS.COMPANY_NAME });
}
```

### Pattern 4: Mobile-First CSS with Touch Targets
**What:** Design CSS for mobile viewport first (360-414px wide), scaling up to tablet. No desktop min-width constraints.

**When:** Any mobile-only app.

**Why:** The existing desktop CSS assumes 920px+ minimum width. Mobile needs larger touch targets (44px minimum), single-column layouts, and viewport-aware sizing.

```css
/* app.css — Mobile First */
:root {
  --touch-target: 44px;  /* Apple HIG minimum tap target */
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* All interactive elements meet touch target minimum */
button, input, select {
  min-height: var(--touch-target);
  font-size: 16px;  /* prevents iOS zoom on focus */
}

/* Single-column layout */
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
}
```

### Pattern 5: Network-Aware Data Loading
**What:** Check network connectivity before making API calls. Show cached data when offline.

**When:** Read-only dashboard where stale data is better than no data.

**Why:** Improves UX on flaky mobile connections.

```javascript
// api.js — With Network Check
import { Network } from '@capacitor/network';

async function safeFetch(path, options) {
  const status = await Network.getStatus();
  if (!status.connected) {
    throw new Error('OFFLINE');
  }
  return apiRequest(path, options);
}
```

## Android-Specific Configuration

### Required AndroidManifest Changes

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
    android:usesCleartextTraffic="true"   <!-- Required for HTTP API -->
    android:networkSecurityConfig="@xml/network_security_config">

    <activity ...>
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
    </activity>
</application>
```

### Network Security Config

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext HTTP only to the specific API server -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">84.235.249.239</domain>
    </domain-config>
    <!-- Block all other cleartext traffic -->
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

### Capacitor Config

```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.usama.stockmanagement.mobile',
  appName: 'Zestok',
  webDir: 'mobile',
  server: {
    cleartext: true,  // Development only — remove before production
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#06152b',
    },
  },
};

export default config;
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reusing Electron Desktop UI Unchanged
**What:** Taking `index.html` and `styles.css` directly from the Electron app without modification.
**Why bad:** Desktop UI assumes 920px+ width, has mouse hover states, uses keyboard shortcuts, and includes Stock Entry/Report views irrelevant to a read-only companion app. On a phone screen (360-414px) it would be unusable.
**Instead:** Write a clean mobile-specific `index.html` with only PIN Gate + Dashboard views. Port only the rendering logic from `renderer.js` (balance calculation, metrics, formatting).

### Anti-Pattern 2: Using localStorage for Auth Tokens
**What:** Storing `deviceToken` and PIN in `localStorage` like the Electron app does.
**Why bad:** The OS can clear WebView localStorage under memory pressure, losing the user's session. This is documented in Capacitor docs as an eviction risk.
**Instead:** Use `@capacitor/preferences` API which maps to Android's `SharedPreferences` — stable across app restarts and not subject to WebView storage eviction.

### Anti-Pattern 3: Building Custom Native Plugins
**What:** Writing Java/Kotlin code to handle HTTP requests or PIN verification natively.
**Why bad:** The WebView already supports `fetch()` for HTTP requests. Building native plugins adds complexity, requires Android Studio, and creates a Java/Kotlin maintenance burden. For a read-only app that calls 3 REST endpoints, the web layer is sufficient.
**Instead:** Keep everything in the web layer. Only use the Capacitor bridge for native capabilities the web cannot access (storage persistence, connectivity detection, splash screen).

### Anti-Pattern 4: Over-Engineering with a Framework
**What:** Adding React, Vue, or Angular for a 2-screen app.
**Why bad:** Adds build tooling (Vite/Webpack), bundle size, and framework learning curve. The existing Electron app uses vanilla JS — the developer is already productive in that pattern.
**Instead:** Use vanilla HTML/JS/CSS SPA architecture. The app has only 2 views and 3 API endpoints — frameworks add zero value here.

### Anti-Pattern 5: Ignoring Android Back Button
**What:** Not handling the Android hardware back button.
**Why bad:** Pressing back on the PIN screen could exit the app unexpectedly. Pressing back on the dashboard should go to the home screen (not a previous "page" in SPA terms).
**Instead:** Use Capacitor's `App.exitApp()` on PIN screen back press, and minimize-to-background on dashboard back press.

## Scalability Considerations

| Concern | At Launch (v1) | Future (v2+) |
|---------|---------------|--------------|
| **State Management** | In-memory JS object + Preferences | Consider a lightweight store if more screens added |
| **API Calls** | Direct `fetch()` with auth header injection | Consider CapacitorHttp plugin if cookie/session management needed |
| **Data Caching** | Offline detection with stale-data fallback | Consider SQLite plugin (`capacitor-sqlite`) for offline-first |
| **Build Size** | ~200KB web assets + 5MB Android shell (typical) | Code-split only if adding many views |
| **Auth** | PIN + TOTP via REST | Consider biometric unlock (fingerprint/face) via Identity Vault |
| **Multi-device** | Single device token per PIN | Device management UI if needed |

## Sources

- Capacitor v8 Official Docs: https://capacitorjs.com/docs (Android, Workflow, Config, Preferences, Http, Security, Storage)
- Existing Electron app: `src/index.html`, `src/renderer.js`, `src/styles.css` (verified API patterns)
- Capacitor Preferences API: https://capacitorjs.com/docs/apis/preferences (eviction warning, SharedPreferences on Android)
- Capacitor Android Security: https://capacitorjs.com/docs/guides/security (cleartext traffic guidelines, localStorage eviction)
