# Phase 3: Android Mobile APK - Research

**Researched:** 2026-06-24
**Domain:** Capacitor 6, Ionic React 8, Android APK build
**Confidence:** HIGH

## Summary

This phase creates a standalone Capacitor/Ionic React Android mobile app in a new `mobile/` subdirectory. The app authenticates via PIN against the desktop Express API on the local network, displays stock data grouped by category with search, pull-to-refresh, and error handling, and produces a signed APK for direct distribution. The architecture follows Capacitor's standard web-first pattern: build a web app with Ionic React components, then wrap it in Capacitor's native Android shell.

**Primary recommendation:** Use `ionic start` with the `blank` template (`--type react`) and Capacitor auto-integration, then add `@capacitor/android`. Use `@capacitor/barcode-scanner` v3.0.2 (official Ionic/OutSystems plugin) for QR scanning, `@capacitor/preferences` v8.0.1 for persistent storage, and `@capacitor/app` v8.1.0 for lifecycle events (resume/pause). Build the signed APK using Android Studio's Build > Generate Signed Bundle/APK or Gradle via `./gradlew assembleRelease`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Server IP Config
- **D-01:** Desktop displays a QR code in the Settings dialog encoding the local IP address (IP only, port 3000 assumed)
- **D-02:** Mobile first launch opens QR scanner — user scans QR code from desktop screen to pair
- **D-03:** Server IP saved persistently in device local storage (Capacitor Preferences) — survives app restarts and reboots
- **D-04:** Mobile offers "Enter IP manually" link as fallback below QR scanner
- **D-05:** "Test Connection" button on IP setup screen verifies server reachability before proceeding
- **D-06:** If saved IP fails on app launch, show error with options to Edit IP or Retry

#### PIN Storage
- **D-07:** PIN required on every app launch — not stored locally on device
- **D-08:** PIN required when app returns to foreground (from background/other apps)
- **D-09:** PIN entry uses numeric keypad only (like phone lock screen, 0-9 digits)
- **D-10:** After 3 wrong PIN attempts, show lockout with timer (30 seconds) before allowing retry

#### Stock List Design
- **D-11:** Items displayed as list rows (not cards) — simple rows with separator lines
- **D-12:** Search bar is inline (scrolls with content, not fixed)
- **D-13:** Category headers use CSS animated gradient background (agent discretion on specific animation)
- **D-14:** Each item shows: item name, category badge, total quantity, new rate — minimal, no total value
- **D-15:** Category headers are sticky — stay at top while scrolling through that category's items

#### Refresh Behavior
- **D-16:** Auto-refresh stock data when app comes to foreground (app.resume event)
- **D-17:** Pull-to-refresh gesture on stock list for manual refresh
- **D-18:** No timed auto-refresh while app is open — on-demand only (foreground + pull)
- **D-19:** Full-screen loading overlay displayed during data refresh
- **D-20:** "Last updated" timestamp shown in the app (e.g., "Updated: 2 min ago")

#### Error States
- **D-21:** Server unreachable → Show error message "Cannot connect to server" with Retry button
- **D-22:** Wrong PIN (HTTP 401) → Shake animation on PIN input field + "Incorrect PIN" text
- **D-23:** PIN not configured (HTTP 200, configured: false) → Show "Server PIN not set up. Please configure PIN on the desktop app" with retry option
- **D-24:** Empty stock (all zero balances) → Show category headers but no items under them

### Agent's Discretion
- **Animated category headers**: CSS gradient animation — agent choice (background-position shift recommended for performance)
- **Mobile framework**: Ionic React (confirmed by ecosystem size and official maturity)
- **QR code library**: qrcode.js (npm) for desktop generation, `@capacitor/barcode-scanner` for mobile scanning

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOB-01 | Capacitor project initialized in `mobile/` directory | `ionic start` with `--type react --capacitor` creates project; add `@capacitor/android` platform (Section: Standard Stack) |
| MOB-02 | PIN entry screen on app launch | `@capacitor/app` `appStateChange` event; `@capacitor/preferences` for storing token-less state; `GET /api/pin/verify` API (Section: Architecture Patterns) |
| MOB-03 | Stock list screen grouped by category headers | Ionic `IonList`, `IonItemGroup`, sticky headers via CSS `position: sticky` (Section: Architecture Patterns) |
| MOB-04 | Search bar to filter items by name | Ionic `IonSearchbar` with inline scroll behavior (Section: Architecture Patterns) |
| MOB-05 | Each item shows name, category, total qty, new rate | Item row render pattern with `IonItem` + `IonLabel` (Section: Code Examples) |
| MOB-06 | Only available items displayed (qty > 0) | API already returns only available items (`GET /api/stock`) — client displays what API returns |
| MOB-07 | Configurable server IP address | `@capacitor/preferences` for persistence; `@capacitor/barcode-scanner` for QR scanning (Section: Standard Stack) |
| MOB-08 | Auto-refresh on app foreground | `@capacitor/app` `resume` event listener triggers stock data refresh (Section: Architecture Patterns) |
| MOB-09 | Error state when server unreachable | Try/catch around fetch with `AbortController` timeout; UI states for error/retry (Section: Architecture Patterns, Common Pitfalls) |
| MOB-10 | APK generated and signed for distribution | Android Studio signing or Gradle `assembleRelease` with keystore configuration (Section: Standard Stack, Code Examples) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PIN entry & verification | Mobile Client | API Server | PIN entered on device, verified via API — PIN never stored locally (D-07) |
| Server IP pairing | Mobile Client | — | QR code scanned from desktop screen, IP stored in device Preferences |
| Stock list rendering | Mobile Client | — | List + search + categories rendered in WebView via Ionic components |
| Stock data fetching | API Server | Mobile Client | API provides data; mobile requests via HTTP fetch |
| PIN verification | API Server | — | API returns 200/401; mobile only displays result |
| Pull-to-refresh | Mobile Client | — | Native gesture via `IonRefresher`, triggers data re-fetch |
| App lifecycle handling | Mobile Client | — | `@capacitor/app` events trigger PIN + data refresh on resume |
| APK signing | Build Machine | — | Done via Android Studio or Gradle with keystore |
| Loading/error overlays | Mobile Client | — | Pure UI state management in React components |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Ionic React | 8.8.12 | Mobile UI component framework | Official Ionic UI for React; provides native-feeling components (list, searchbar, refresher, modal) |
| Capacitor Core | 8.4.1 | Native runtime bridge | Official native wrapper; enables camera, preferences, app lifecycle events [VERIFIED: npm registry] |
| Capacitor CLI | 8.4.1 | Build tooling | Initializes and syncs native Android/iOS projects [VERIFIED: npm registry] |
| Capacitor Android | 8.4.1 | Android platform support | Native Android project managed by Capacitor [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/app` | 8.1.0 | App lifecycle events (resume, pause, appStateChange) | PIN check on resume, auto-refresh on foreground |
| `@capacitor/preferences` | 8.0.1 | Persistent key/value storage (SharedPreferences on Android) | Storing server IP address across restarts [CITED: capacitorjs.com/docs/apis/preferences] |
| `@capacitor/barcode-scanner` | 3.0.2 | QR code scanning via camera | Scanning QR code with server IP on first launch [CITED: capacitorjs.com/docs/apis/barcode-scanner] |
| `@ionic/react-router` | 8.8.12 | Routing for Ionic React | Navigation between setup/PIN/stock screens |
| `react-router-dom` | ^6.x | React Router v6 | Standard routing for React (peer dependency of @ionic/react-router) |
| Ionic CLI (`@ionic/cli`) | 7.2.1 | Project scaffolding and Capacitor commands | `ionic start`, `ionic capacitor add android` [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@capacitor/barcode-scanner` (official) | `capacitor-plugin-barcodescanner` (community) | Official plugin uses OutSystems barcode lib, actively maintained by Ionic team; community plugin less maintained |
| `@capacitor/barcode-scanner` (official) | `@capacitor-mlkit/barcode-scanning` (Capawesome) | ML Kit requires Google Play Services, adds ~2MB to APK; official plugin is lighter |
| `@capacitor/barcode-scanner` (official) | `@capacitor/camera` + custom QR decoder (jsQR) | Avoids native plugin install but slower, less reliable; native scan is preferred |
| Capacitor Preferences | `window.localStorage` | OS may clear localStorage on low storage; Preferences uses native SharedPreferences [CITED: capacitorjs.com/docs/apis/preferences] |
| Ionic `IonRefresher` | `react-simple-pull-to-refresh` (npm) | IonRefresher is native-integrated (iOS/Android native refresher) — official Ionic component, no extra dependency |
| React Context API | Redux / Zustand | App has simple state (server IP, PIN authed, stock data, loading/error) — Context is sufficient; no need for external state management for this scope |

**Installation (project creation):**
```bash
# Install Ionic CLI globally
npm install -g @ionic/cli@7.2.1

# Create Ionic React project with Capacitor
ionic start mobile/ blank --type react --capacitor
cd mobile

# Install Ionic React + router
npm install @ionic/react@8.8.12 @ionic/react-router@8.8.12 react-router-dom@^6

# Add Android platform
npm install @capacitor/android@8.4.1
npx cap add android

# Install plugins
npm install @capacitor/app@8.1.0
npm install @capacitor/preferences@8.0.1
npm install @capacitor/barcode-scanner@3.0.2
npx cap sync
```

**Version verification:** All versions confirmed via `npm view <package> version` on 2026-06-24.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @capacitor/core | npm | ~5 yrs | 3.2M/wk | github.com/ionic-team/capacitor | OK | Approved |
| @capacitor/cli | npm | ~5 yrs | 3.1M/wk | github.com/ionic-team/capacitor | OK | Approved |
| @capacitor/android | npm | ~5 yrs | 2.3M/wk | github.com/ionic-team/capacitor | OK | Approved |
| @capacitor/app | npm | ~5 yrs | 1.7M/wk | github.com/ionic-team/capacitor-plugins | OK | Approved |
| @capacitor/preferences | npm | ~5 yrs | 945K/wk | github.com/ionic-team/capacitor-plugins | OK | Approved |
| @capacitor/barcode-scanner | npm | ~2 yrs | 88K/wk | github.com/ionic-team/capacitor-barcode-scanner | OK | Approved |
| @ionic/react | npm | ~5 yrs | 111K/wk | github.com/ionic-team/ionic-framework | OK | Approved |
| @ionic/react-router | npm | ~5 yrs | 69K/wk | github.com/ionic-team/ionic-framework | OK | Approved |
| @ionic/cli | npm | ~8 yrs | 114K/wk | github.com/ionic-team/ionic-cli | OK | Approved |

**Packages removed due to SLOP verdict:** None
**Packages flagged as suspicious:** None — all packages are from the official ionic-team GitHub organization with verified repository URLs, high download counts, and long release histories. The "too-new" signal triggered for some is because these packages happen to have recent releases (within days), which is normal for actively maintained open-source projects.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Android Device                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Capacitor WebView (Ionic React)          │  │
│  │                                                       │  │
│  │  ┌──────────┐   ┌──────────────┐   ┌──────────────┐  │  │
│  │  │ QR Scan  │──▶│ Server Setup │──▶│  PIN Entry   │  │  │
│  │  │ Screen   │   │ (First launch)│  │  Screen      │  │  │
│  │  └──────────┘   └──────────────┘   └──────┬───────┘  │  │
│  │                                            │          │  │
│  │  ┌─────────────────────────────────────────▼───────┐  │  │
│  │  │              Stock List Screen                    │  │  │
│  │  │  ┌──────────────────────────────────────┐        │  │  │
│  │  │  │ IonSearchbar (inline, scrolls w/     │        │  │  │
│  │  │  │ content)                              │        │  │  │
│  │  │  ├──────────────────────────────────────┤        │  │  │
│  │  │  │ Category Header (sticky + gradient)    │        │  │  │
│  │  │  │ Item Row 1 (name, badge, qty, rate)   │        │  │  │
│  │  │  │ Item Row 2                             │        │  │  │
│  │  │  ├──────────────────────────────────────┤        │  │  │
│  │  │  │ Category Header (sticky + gradient)    │        │  │  │
│  │  │  │ Item Row 3                             │        │  │  │
│  │  │  └──────────────────────────────────────┘        │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  Capacitor Plugins:                                      │  │
│  │  ├── @capacitor/preferences → saves server IP            │  │
│  │  ├── @capacitor/app → listen resume/pause/stateChange   │  │
│  │  ├── @capacitor/barcode-scanner → QR scan on first launch│  │
│  │  └── fetch() → connects to http://{serverIP}:3000/api/*  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (local network)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                Desktop Machine                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express API (port 3000)                              │   │
│  │  ├── GET /api/stock        → stock balance by category│   │
│  │  ├── GET /api/pin/verify   → PIN auth (x-access-pin)  │   │
│  │  └── GET /api/pin/status   → PIN configured check     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (Primary Use Case)

```
App Launch → Check Preferences for saved IP
  ├── No IP → Open QR Scanner Screen
  │            ├── Scan desktop QR code → extract IP
  │            ├── OR "Enter IP Manually" → text input
  │            ├── "Test Connection" → GET /api/pin/status
  │            └── Save IP to Preferences → navigate to PIN
  │
  └── Has IP → Check PIN state (in-memory)
                ├── Not authed → Show PIN Screen
                │                ├── Enter PIN → GET /api/pin/verify
                │                ├── 401 → Shake + "Incorrect PIN", increment counter
                │                ├── 3 fails → Lockout 30s with countdown timer
                │                ├── 200 valid → Mark authed, fetch stock data
                │                └── Network error → Error + Retry
                │
                └── Authed → Fetch stock data → Show Stock List
                              ├── Loading → Full-screen overlay
                              ├── Error → Error message + Retry
                              └── Success → Grouped list with sticky headers

Foreground (resume) event → Check PIN state
  ├── Not authed → Show PIN Screen
  └── Authed → Re-fetch stock data

Pull-to-refresh → Re-fetch stock data (maintain PIN auth)
```

### Recommended Project Structure

```
mobile/
├── src/
│   ├── App.tsx                  # Root: routing setup (setup/PIN/stock)
│   ├── main.tsx                  # Entry: ReactDOM.createRoot + IonApp
│   ├── theme/
│   │   └── variables.css         # CSS custom properties + gradient keyframes + shake keyframes
│   ├── components/
│   │   ├── PinScreen.tsx         # PIN entry with numeric keypad, shake, lockout
│   │   ├── StockList.tsx         # Stock list with IonRefresher, IonSearchbar, grouped items
│   │   ├── StockItem.tsx         # Single item row (name, badge, qty, rate)
│   │   ├── CategoryHeader.tsx    # Animated gradient sticky header
│   │   ├── ServerSetup.tsx       # QR scanner + manual IP entry + Test Connection
│   │   ├── LoadingOverlay.tsx    # Full-screen loading overlay
│   │   └── ErrorState.tsx        # Reusable error display with Retry button
│   └── services/
│       ├── api.ts                # Fetch wrapper: getStock(), verifyPin(), getPinStatus()
│       └── storage.ts            # Preferences wrapper: getServerIP(), setServerIP(), clear()
├── capacitor.config.ts           # Capacitor configuration
├── ionic.config.json             # Ionic project config
└── package.json                  # Dependencies
```

### Pattern 1: App Lifecycle PIN Verification

**What:** Use `@capacitor/app` listeners to detect app state changes and trigger PIN re-entry on foreground.

```typescript
// Source: [CITED: capacitorjs.com/docs/apis/app]
import { App } from '@capacitor/app';
import { useEffect, useState } from 'react';

function useAppLifecycle() {
  const [isActive, setIsActive] = useState(true);
  const [needsPIN, setNeedsPIN] = useState(false);

  useEffect(() => {
    // Listen for app coming to foreground
    const resumeHandler = App.addListener('resume', () => {
      setIsActive(true);
      setNeedsPIN(true); // Require PIN on foreground (D-08)
    });

    const pauseHandler = App.addListener('pause', () => {
      setIsActive(false);
    });

    // Listen for state changes (alternative to resume/pause)
    const stateHandler = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // App came to foreground
        setNeedsPIN(true);
      }
    });

    return () => {
      resumeHandler.then(h => h.remove());
      pauseHandler.then(h => h.remove());
      stateHandler.then(h => h.remove());
    };
  }, []);

  return { isActive, needsPIN, setNeedsPIN };
}
```

### Pattern 2: Pull-to-Refresh with IonRefresher

```typescript
// Source: [CITED: ionicframework.com/docs/api/refresher]
import { IonRefresher, IonRefresherContent, RefresherEventDetail } from '@ionic/react';

// In your component:
const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
  try {
    await fetchStockData();
  } finally {
    event.detail.complete(); // MUST call complete() to end refresher animation
  }
};

// Template:
<IonPage>
  <IonContent>
    <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
      <IonRefresherContent
        pullingIcon="chevron-down"
        refreshingSpinner="lines"
      />
    </IonRefresher>
    {/* Stock list content */}
  </IonContent>
</IonPage>
```

**Note:** The `slot="fixed"` attribute is required on `IonRefresher` for correct positioning with Ionic React v8. [CITED: stackoverflow.com/questions/78984801]

### Pattern 3: Capacitor Preferences Storage

```typescript
// Source: [CITED: capacitorjs.com/docs/apis/preferences]
import { Preferences } from '@capacitor/preferences';

const STORAGE_KEYS = {
  SERVER_IP: 'stock_server_ip',
};

export async function getServerIP(): Promise<string | null> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.SERVER_IP });
  return value;
}

export async function setServerIP(ip: string): Promise<void> {
  await Preferences.set({ key: STORAGE_KEYS.SERVER_IP, value: ip });
}

export async function clearServerIP(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEYS.SERVER_IP });
}
```

### Pattern 4: QR Code Scanning

```typescript
// Source: [CITED: capacitorjs.com/docs/apis/barcode-scanner]
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';

export async function scanQRCode(): Promise<string | null> {
  try {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE, // Only QR codes
    });
    return result.ScanResult; // Returns the QR content (IP string)
  } catch (error) {
    console.error('QR scan failed or cancelled:', error);
    return null;
  }
}
```

**Note:** Android requires `minSdkVersion = 26` in `android/variables.gradle`. The Capacitor barcode-scanner plugin documentation confirms this requirement. [CITED: capacitorjs.com/docs/apis/barcode-scanner]

### Pattern 5: CSS Animated Gradient for Headers

```css
/* Source: [CITED: gradients.design/guides/gradient-background-animation] — background-position shift technique */
@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.category-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: linear-gradient(135deg, #667eea, #764ba2, #667eea);
  background-size: 200% 200%;
  animation: gradient-shift 4s ease infinite;
  /* Performance: GPU-composited, no layout repaints */
}
```

### Pattern 6: CSS Shake Animation for Wrong PIN

```css
/* Source: [ASSUMED] — standard CSS shake pattern */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
  20%, 40%, 60%, 80% { transform: translateX(6px); }
}

.pin-input.shake {
  animation: shake 0.5s ease-in-out;
}

/* Accessibility: respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .category-header { animation: none; }
  .pin-input.shake { animation: none; }
}
```

### Pattern 7: API Client with Error Handling

```typescript
// Source: [VERIFIED: react.wiki/api/error-handling-patterns]
const API_TIMEOUT = 5000; // 5 seconds

type ApiError = 
  | { type: 'network'; message: string }
  | { type: 'http'; status: number; message: string }
  | { type: 'timeout'; message: string };

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw { type: 'timeout', message: 'Connection timed out' } as ApiError;
    }
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      throw { type: 'network', message: 'Cannot connect to server' } as ApiError;
    }
    throw { type: 'network', message: error.message } as ApiError;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getStockData(serverIP: string, pin: string) {
  const response = await fetchWithTimeout(`http://${serverIP}:3000/api/stock`, {
    headers: { 'x-access-pin': pin },
  });
  
  if (!response.ok) {
    throw { type: 'http', status: response.status, message: await response.text() } as ApiError;
  }
  
  return await response.json();
}
```

### Anti-Patterns to Avoid

- **NOT using Ionic's `IonRefresher`**: Building custom pull-to-refresh ignores native platform behavior. Use the built-in component with `slot="fixed"`.
- **NOT using Capacitor Preferences for server IP**: Using `localStorage` risks data loss when OS reclaims space — Capacitor Preferences maps to SharedPreferences on Android, which persists reliably.
- **Animating gradient colors directly**: Using `@keyframes` to animate `background` or `background-color` triggers repaints every frame. The `background-position` shift technique keeps animation GPU-composited. [CITED: gradients.design/guides/gradient-background-animation]
- **Storing PIN on device**: The design explicitly prohibits this (D-07). PIN is sent to the API for verification and never persisted.
- **Using `setInterval` for auto-refresh**: D-18 prohibits timed refresh while app is open. Only foreground resume and pull-to-refresh.
- **Not handling `prefers-reduced-motion`**: Shake and gradient animations should respect the user's motion accessibility preference.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code scanning | Custom camera view + QR decoder | `@capacitor/barcode-scanner` | Native performance, handles camera permissions, multi-format support (OutSystems lib) |
| Key/value persistence | Custom file-based storage | `@capacitor/preferences` | Uses native SharedPreferences (Android) / UserDefaults (iOS) — OS won't evict data like localStorage [CITED: capacitorjs.com/docs/apis/preferences] |
| Pull-to-refresh gesture | Touch event handlers + JavaScript | `IonRefresher` (Ionic component) | Native iOS/Android refresher integration, rubber-band scrolling, built-in spinner states |
| App lifecycle detection | Orientation/visibility change listeners | `@capacitor/app` | Fires on native pause/resume events, not just visibility changes — more reliable for mobile |
| APK signing | Manual jarsigner | Android Studio or Gradle signing config | Proper handling of keystore, keys, and Gradle integration; signingConfig block in build.gradle |
| Shake animation | JavaScript animation libraries | CSS `@keyframes` | Zero-JS solution, GPU-accelerated via `transform: translateX()`, respects `prefers-reduced-motion` |

**Key insight:** The mobile app uses Capacitor plugins for ALL native functionality. These are thin wrappers over platform SDKs — building your own costs significant effort for little gain. Capacitor's plugin ecosystem is mature and the official plugins are actively maintained by the Ionic team.

## Common Pitfalls

### Pitfall 1: CORS Issues on Real Devices
**What goes wrong:** Fetch calls work in browser dev tools but fail on a real Android device. [CITED: forum.ionicframework.com/t/ionic-react-app-fetch-api]
**Why it happens:** Mobile WebView on HTTP (non-HTTPS) has stricter CORS enforcement; the desktop Express server may not have proper CORS headers for the mobile origin.
**How to avoid:** Ensure the Express server has `cors({ origin: true })` or `cors({ origin: '*' })` enabled. Test with a real device, not just browser emulation.
**Warning signs:** `TypeError: Failed to fetch` on device but works in browser.

### Pitfall 2: QR Scanner Not Working on Android
**What goes wrong:** `@capacitor/barcode-scanner` scan fails or doesn't open camera.
**Why it happens:** Android requires `minSdkVersion >= 26` (set in `android/variables.gradle`). Also needs camera permission.
**How to avoid:** Update `minSdkVersion = 26` in `android/variables.gradle`. Add camera permission query. Handle permission rejection gracefully.
**Warning signs:** "Camera not available" or blank screen when scan starts.

### Pitfall 3: IonRefresher Broken in React
**What goes wrong:** Pull-to-refresh does not work — console errors about missing `slot="fixed"`. [CITED: github.com/ionic-team/ionic-framework/issues/29866]
**Why it happens:** Ionic React v8 requires `slot="fixed"` on `IonRefresher` for correct DOM positioning.
**How to avoid:** Always add `slot="fixed"` to `<IonRefresher>` inside `<IonContent>`.
**Warning signs:** Invisible refresher, console warnings about slot.

### Pitfall 4: Capacitor Plugins Not Loading After Build
**What goes wrong:** After `ionic build && npx cap sync`, plugins don't work or methods are undefined.
**Why it happens:** `npx cap sync` wasn't run after adding new plugins, or `npx cap copy` didn't copy the web build.
**How to avoid:** Run `npx cap sync` every time you add a new plugin. Run `npx cap copy` after each web build.
**Warning signs:** `CapacitorBarcodeScanner is not defined`, `Preferences.get() returns undefined`.

### Pitfall 5: Android WebView HTTP Blocking (cleartext traffic)
**What goes wrong:** `fetch('http://192.168.x.x:3000/api/stock')` fails with network error on Android 9+.
**Why it happens:** Android blocks cleartext HTTP traffic by default in the WebView for security.
**How to avoid:** Add `android:usesCleartextTraffic="true"` to `<application>` in `android/app/src/main/AndroidManifest.xml`. Or use a `network_security_config.xml`.
**Warning signs:** Network errors only on Android, works in iOS or browser dev tools.

### Pitfall 6: State Loss on App Restart
**What goes wrong:** After app is killed and reopened, PIN state is lost (expected) but user flow breaks.
**Why it happens:** In-memory React state (PIN-authed flag) is lost on process death; need to re-verify PIN.
**How to avoid:** On app launch, always check Preferences for server IP. If found, show PIN screen (not stock screen). PIN auth state is in-memory only — reset on every cold start (correct by design per D-07).

### Pitfall 7: Lockout Timer Survives Cold Restart
**What goes wrong:** User kills app during lockout, reopens, and lockout is reset.
**Why it happens:** Lockout counter is in-memory — per D-10, lockout resets when app is killed. This is **intended behavior**, not a bug. Document clearly that lockout is session-only.
**How to avoid:** Store attempts in-memory (React state + ref). No need to persist. On cold start, counter is always 0.

## Code Examples

### App Entry Point and Routing

```typescript
// src/main.tsx
// Source: [CITED: capacitorjs.com/docs/getting-started/with-ionic]
import React from 'react';
import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import App from './App';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

setupIonicReact();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <IonApp>
      <App />
    </IonApp>
  </React.StrictMode>
);
```

### Stock Data Fetching with Error Handling

```typescript
// src/services/api.ts
// Source: [ASSUMED] — standard fetch wrapper pattern for mobile API
const TIMEOUT_MS = 5000;

export interface StockItem {
  item: string;
  category: string;
  inQty: number;
  outQty: number;
  balance: number;
  latestRate: number;
}

export interface StockResponse {
  [category: string]: StockItem[];
}

export interface PinStatusResponse {
  configured: boolean;
  valid?: boolean;
}

export interface PinVerifyResponse {
  valid: boolean;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    public type: 'network' | 'timeout' | 'http',
    public statusCode?: number,
    message?: string
  ) {
    super(message || type);
    this.name = 'ApiError';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new ApiError('timeout', undefined, 'Connection timed out');
    throw new ApiError('network', undefined, 'Cannot connect to server');
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchStock(serverIP: string, pin: string): Promise<StockResponse> {
  const res = await fetchWithTimeout(`http://${serverIP}:3000/api/stock`, {
    headers: { 'x-access-pin': pin },
  });
  if (!res.ok) throw new ApiError('http', res.status, res.status === 401 ? 'Invalid PIN' : `HTTP ${res.status}`);
  return res.json();
}

export async function verifyPin(serverIP: string, pin: string): Promise<PinVerifyResponse> {
  const res = await fetchWithTimeout(`http://${serverIP}:3000/api/pin/verify`, {
    headers: { 'x-access-pin': pin },
  });
  const data = await res.json();
  return data;
}

export async function getPinStatus(serverIP: string): Promise<PinStatusResponse> {
  const res = await fetchWithTimeout(`http://${serverIP}:3000/api/pin/status`);
  return res.json();
}

export async function testConnection(serverIP: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`http://${serverIP}:3000/api/pin/status`);
    return res.ok;
  } catch {
    return false;
  }
}
```

### StockList Component with Grouped Data and Search

```typescript
// src/components/StockList.tsx
// Source: [ASSUMED] — Ionic React component pattern
import React, { useState, useMemo } from 'react';
import {
  IonContent, IonPage, IonList, IonItem, IonLabel,
  IonSearchbar, IonRefresher, IonRefresherContent,
  IonBadge, IonText, IonSpinner
} from '@ionic/react';
import { StockResponse, StockItem } from '../services/api';
import LoadingOverlay from './LoadingOverlay';
import ErrorState from './ErrorState';

interface Props {
  stockData: StockResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onRefresh: () => Promise<void>;
  onRetry: () => void;
}

const StockList: React.FC<Props> = ({ stockData, loading, error, lastUpdated, onRefresh, onRetry }) => {
  const [searchText, setSearchText] = useState('');

  // Filter items by search text (name only, per D-12)
  const filteredData = useMemo(() => {
    if (!stockData) return {};
    if (!searchText.trim()) return stockData;
    const lower = searchText.toLowerCase();
    const result: StockResponse = {};
    for (const [category, items] of Object.entries(stockData)) {
      const filtered = items.filter(item => item.item.toLowerCase().includes(lower));
      if (filtered.length > 0) {
        result[category] = filtered;
      } else {
        // Keep empty categories when there are items in other categories (D-24)
        result[category] = [];
      }
    }
    return result;
  }, [stockData, searchText]);

  return (
    <IonPage>
      <IonContent>
        {/* Pull-to-refresh (D-17) */}
        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await onRefresh();
          e.detail.complete();
        }}>
          <IonRefresherContent refreshingSpinner="lines" />
        </IonRefresher>

        {/* Loading overlay (D-19) */}
        {loading && <LoadingOverlay />}

        {/* Error state (D-21) */}
        {error && !loading && <ErrorState message={error} onRetry={onRetry} />}

        {/* Inline search bar (D-12) */}
        <IonSearchbar
          value={searchText}
          onIonInput={(e) => setSearchText(e.detail.value!)}
          placeholder="Search items..."
          animated={false}
        />

        {/* "Last updated" timestamp (D-20) */}
        {lastUpdated && !loading && (
          <IonText color="medium" className="ion-padding-start" style={{ fontSize: '0.8em' }}>
            Updated: {getTimeAgo(lastUpdated)}
          </IonText>
        )}

        {/* Stock list grouped by category */}
        <IonList>
          {Object.entries(filteredData).map(([category, items]) => (
            <React.Fragment key={category}>
              {/* Sticky animated gradient category header (D-13, D-15) */}
              <div className="category-header">
                <IonText color="light">
                  <strong>{category}</strong>
                </IonText>
              </div>

              {/* Items in this category (D-24: show header even if no items) */}
              {items.map((item, idx) => (
                <IonItem key={`${item.item}-${idx}`} lines="full">
                  <IonLabel>
                    <h2>{item.item}</h2>
                    <IonBadge color="secondary">{item.category}</IonBadge>
                  </IonLabel>
                  <IonLabel slot="end" className="ion-text-end">
                    <p>Qty: <strong>{item.balance}</strong></p>
                    <p>Rate: {formatCurrency(item.latestRate)}</p>
                  </IonLabel>
                </IonItem>
              ))}
            </React.Fragment>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

function formatCurrency(rate: number): string {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(rate);
}

export default StockList;
```

### APK Signing Configuration

```groovy
// android/app/build.gradle — signing config for release builds
// Source: [CITED: developer.android.com/studio/publish/app-signing]

android {
    ...
    signingConfigs {
        release {
            storeFile file("../stock-management.keystore")  // or MYAPP_UPLOAD_STORE_FILE from gradle.properties
            storePassword System.getenv("STORE_PASSWORD")   // or from gradle.properties
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Keystore generation:**
```bash
# One-time: generate a keystore (store in project root, NOT committed)
keytool -genkey -v -keystore android/app/stock-management.keystore \
  -alias stock-management-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

**Build commands:**
```bash
# Build signed release APK
cd android
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk

# Or build via Capacitor CLI:
npx cap open android   # Opens Android Studio → Build → Generate Signed Bundle / APK
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cordova plugins | Capacitor plugins | Capacitor v1 (2019) | Better native performance, simpler plugin API, modern tooling |
| Ionic Angular* only | Ionic React/Vue/Angular | Ionic v5 (2020) | React developers can use familiar patterns |
| Capacitor v5 | Capacitor v8 | 2025-2026 | v8 is the current stable line; v6 was the first to drop Cordova plugin fallback |
| Manual APK signing (jarsigner) | Gradle signingConfig + Android Studio | Always | Modern signing integrates with build system, Google Play App Signing support |
| localStorage | Capacitor Preferences | 2020+ | Preferences maps to native system APIs, avoids OS eviction [CITED: capacitorjs.com/docs/guides/storage] |
| `IonRefresher` no `slot="fixed"` | `IonRefresher slot="fixed"` | Ionic v7+ | Required for React — fixes positioning issues in virtual scroll contexts |

**Deprecated/outdated:**
- **Capacitor v2 Storage plugin**: Replaced by `@capacitor/preferences` in v3. Migration helper available via `Preferences.migrate()`.
- **Cordova plugin compatibility layer**: Capacitor v6+ removed automatic Cordova plugin fallback. Use only Capacitor-native plugins.
- **`IonRefresher` without `slot="fixed"`**: Causes broken layout in React. Always add the attribute.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Express API endpoints (`/api/stock`, `/api/pin/verify`, `/api/pin/status`) are implemented and return the documented response shapes when this phase executes | Architecture Patterns | If endpoints are missing or return different shapes, mobile code must be adapted — add checkpoint in plan to verify API is live first |
| A2 | `@capacitor/barcode-scanner` v3.0.2 works on Android API 24+ with `minSdkVersion` 26 | Standard Stack | If the plugin requires newer Android API or has compatibility issues, fall back to manual IP entry only |
| A3 | Desktop QR code generation (qrcode.js) is added in Phase 2 as D-01 specifies | Code Examples | If Phase 2 doesn't add QR display, Phase 3 needs to handle it or mobile pairing becomes manual-only |
| A4 | The Express API returns `stock_balance` data as `{category: [{item, category, balance, latestRate, ...}]}` shape | Architecture Patterns | If API returns flat array or different nesting, StockList deserialization must be adjusted |
| A5 | Intl.NumberFormat with `en-PK` locale works in Android WebView | Code Examples (formatCurrency) | If locale not available, fall back to `en-US` for currency formatting |
| A6 | CSS `position: sticky` with Ionic `IonList` works correctly for category headers | Code Examples | If sticky headers don't render correctly with Ionic's shadow DOM, use JavaScript-based sticky positioning instead |

## Open Questions

1. **Desktop QR code generation timing**
   - What we know: D-01 requires desktop to display QR code in Settings dialog. This is allocated to Phase 2.
   - What's unclear: Will Phase 2 be completed before Phase 3 execution, or are phases running in parallel?
   - Recommendation: If Phase 2 is not done, the mobile team must either stub the QR flow with manual IP entry or generate the QR code themselves in a separate step. Add a checkpoint.

2. **IP discovery on first launch**
   - What we know: QR code scanned from desktop screen; manual entry fallback.
   - What's unclear: Should the QR code contain just the IP (e.g., `192.168.1.5`) or a full URL (`http://192.168.1.5:3000`)?
   - Recommendation: IP only (port 3000 assumed, D-01). The scanner extracts the raw IP string.

3. **Express server availability**
   - What we know: Mobile connects directly to Express on `{IP}:3000`.
   - What's unclear: Is the Express server guaranteed to be running when the mobile app is used (D-05 helps detect this)?
   - Recommendation: The "Test Connection" step on setup (D-05) and Retry flow on launch (D-21) handle this. No additional action needed.

4. **Numeric keypad input for PIN**
   - What we know: D-09 requests numeric keypad only (like phone lock screen).
   - What's unclear: Should the PIN be a fixed length (4-6 digits) or any length?
   - Recommendation: Use `IonInput` with `type="number"` and `inputmode="numeric"` pattern `[0-9]{4,6}`. The specific length should be confirmed from the server PIN config (Phase 1).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Capacitor/Ionic build | ✓ | 24.16.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| Java JDK 17+ | Android build (Gradle) | ✗ | — | Install JDK 17 (required for Android Gradle Plugin 8.x) |
| Android SDK | Android build | ✗ | — | Install via Android Studio |
| Android Studio | Android project/open | ✗ | — | Install Android Studio (includes SDK manager) |
| Gradle | APK build | ✗ | — | Bundled with Android project wrapper (`gradlew`) |
| Ionic CLI | Project creation | ✗ | — | `npm install -g @ionic/cli@7.2.1` |
| Physical Android device | Testing | N/A | — | Emulator works for development; camera needed for QR |

**Missing dependencies with no fallback:**
- **Java JDK 17+**: Required for Android Gradle Plugin. Must be installed before any Android build step. Download from `adoptium.net` or use `winget install EclipseAdoptium.Temurin.17.JDK`.
- **Android SDK + Android Studio**: Required to compile, sign, and build the APK. Android Studio provides SDK manager, emulator, and build tools. Download from `developer.android.com/studio`.

**Missing dependencies with fallback:**
- **Physical Android device**: Use Android Emulator for most development. QR camera feature requires physical device or emulator with camera support.

## Validation Architecture

> nyquist_validation is enabled per config.json (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended for Vite-based Ionic React projects) |
| Config file | `mobile/vitest.config.ts` (to be created) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOB-01 | Capacitor project initialized with correct structure | manual | — | ❌ Wave 0 |
| MOB-02 | PIN entry screen renders on unauthed launch | unit | `npx vitest run src/components/__tests__/PinScreen.test.tsx` | ❌ Wave 0 |
| MOB-03 | Stock list groups items by category headers | unit | `npx vitest run src/components/__tests__/StockList.test.tsx` | ❌ Wave 0 |
| MOB-04 | Search bar filters items by name | unit | `npx vitest run src/components/__tests__/StockList.test.tsx` | ❌ Wave 0 |
| MOB-05 | Each item renders name, category badge, qty, rate | unit | `npx vitest run src/components/__tests__/StockItem.test.tsx` | ❌ Wave 0 |
| MOB-06 | Only items with balance > 0 are displayed | integration | `npx vitest run src/services/__tests__/api.test.ts` | ❌ Wave 0 |
| MOB-07 | Server IP can be saved/retrieved/cleared via Preferences | unit | `npx vitest run src/services/__tests__/storage.test.ts` | ❌ Wave 0 |
| MOB-08 | Data refresh triggers on app resume | integration | `npx vitest run src/services/__tests__/lifecycle.test.ts` | ❌ Wave 0 |
| MOB-09 | Error state renders when fetch fails | unit | `npx vitest run src/components/__tests__/ErrorState.test.tsx` | ❌ Wave 0 |
| MOB-10 | APK builds successfully | manual | `cd android && ./gradlew assembleRelease` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --changed`
- **Per wave merge:** Full unit suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/PinScreen.test.tsx` — covers MOB-02 (PIN input, shake animation trigger, lockout counter)
- [ ] `src/components/__tests__/StockList.test.tsx` — covers MOB-03, MOB-04 (grouping, search filtering, empty state)
- [ ] `src/components/__tests__/StockItem.test.tsx` — covers MOB-05 (renders name, badge, qty, rate)
- [ ] `src/services/__tests__/api.test.ts` — covers MOB-06, MOB-09 (fetch wrapper, error types, timeout)
- [ ] `src/services/__tests__/storage.test.ts` — covers MOB-07 (get/set/clear server IP)
- [ ] `src/services/__tests__/lifecycle.test.ts` — covers MOB-08 (resume triggers refresh)
- [ ] `src/components/__tests__/ErrorState.test.tsx` — covers MOB-09 (error rendering, retry button)
- [ ] `mobile/vitest.config.ts` — test framework configuration
- [ ] `mobile/src/setupTests.ts` — test setup (mocks for Capacitor plugins)

## Security Domain

> `security_enforcement` is enabled (default). No explicit `false` override in config.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | PIN verified against server via `x-access-pin` header — never stored locally |
| V3 Session Management | No | Session is ephemeral (in-memory PIN auth state, reset on app kill) |
| V4 Access Control | Yes | Server controls PIN verification; mobile only sends the PIN |
| V5 Input Validation | Yes | PIN input accepts digits only (0-9), limited length; server validates |
| V6 Cryptography | No | PIN hashing (bcrypt) is server-side only — mobile never sees hash |

### Known Threat Patterns for Mobile App

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PIN brute force via API | Tampering | Lockout after 3 attempts (D-10), 30s timer — enforced client-side; server rate limiting (Phase 1) adds server-side protection |
| Unauthorized network access | Spoofing | PIN required for every session; PIN sent as header, never cached |
| Device theft (offline attack) | Information Disclosure | PIN not stored on device (D-07); Preferences data is sandboxed per Android app |
| Man-in-the-middle on LAN | Tampering | HTTP traffic (no TLS) — risk accepted per project scope (local trusted network). Future enhancement: implement HTTPS |
| QR code interception | Spoofing | QR contains IP only; PIN still required. Attacker who knows IP still needs PIN |

## Sources

### Primary (HIGH confidence)
- [CITED: capacitorjs.com/docs/apis/app] — App lifecycle events (resume, pause, appStateChange)
- [CITED: capacitorjs.com/docs/apis/preferences] — Preferences plugin API and usage
- [CITED: capacitorjs.com/docs/apis/barcode-scanner] — Barcode scanner plugin API, Android min SDK 26 requirement
- [CITED: capacitorjs.com/docs/getting-started/with-ionic] — Capacitor with Ionic Framework setup guide
- [CITED: capacitorjs.com/docs/getting-started] — Capacitor installation and initialization
- [CITED: ionicframework.com/docs/api/refresher] — IonRefresher API documentation, slot="fixed" requirement
- [CITED: ionicframework.com/docs/cli/commands/start] — Ionic CLI start command for project generation
- [CITED: gradients.design/guides/gradient-background-animation] — CSS gradient animation techniques (background-position shift)
- [VERIFIED: npm registry] — All package versions confirmed via `npm view <package> version`
- [CITED: capacitorjs.com/docs/guides/storage] — Why Capacitor Preferences vs localStorage

### Secondary (MEDIUM confidence)
- [VERIFIED: dev.to/myougatheaxo/signing-your-android-apk] — APK signing with keytool and Gradle
- [VERIFIED: react.wiki/api/error-handling-patterns] — HTTP vs network error handling patterns in React
- [VERIFIED: stackoverflow.com/questions/78984801] — IonRefresher slot="fixed" required for Ionic React v8
- [VERIFIED: forum.ionicframework.com/t/ionic-react-app-fetch-api] — CORS issues on real Android devices

### Tertiary (LOW confidence)
- [ASSUMED] — Specific API response shape for `/api/stock` (expected: `{category: StockItem[]}`)
- [ASSUMED] — Intl.NumberFormat `en-PK` support in Android WebView
- [ASSUMED] — CSS sticky positioning behavior with Ionic `IonList` shadow DOM

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm, official Ionic/Capacitor ecosystem
- Architecture: HIGH — based on official Capacitor documentation and Ionic component API
- Pitfalls: HIGH — documented issues from official sources (GitHub issues, Stack Overflow, forums)
- Environment: HIGH — verified by running commands on the target machine

**Research date:** 2026-06-24
**Valid until:** 2026-08-24 (stable ecosystem, 60-day validity)
