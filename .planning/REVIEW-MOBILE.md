---
phase: code-review
reviewed: 2026-07-13T14:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - mobile/src/api.js
  - mobile/src/auth.js
  - mobile/src/balances.js
  - mobile/src/config.js
  - mobile/src/connectivity.js
  - mobile/src/dashboard.js
  - mobile/src/main.js
  - mobile/src/ratecheck.js
  - mobile/src/settings.js
  - mobile/src/style.css
  - mobile/index.html
  - mobile/capacitor.config.ts
  - mobile/vite.config.js
  - mobile/package.json
  - mobile/android/app/build.gradle
  - mobile/android/app/src/main/AndroidManifest.xml
  - mobile/android/app/src/main/res/xml/network_security_config.xml
findings:
  critical: 6
  warning: 10
  info: 8
  total: 24
status: issues_found
---

# Phase: Code Review Report — Mobile App (Zestok)

**Reviewed:** 2026-07-13T14:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Zestok mobile companion app — a Capacitor v8 Android app with PIN auth, dashboard, rate check, settings, and biometric unlock. The codebase is well-structured with clear module separation, consistent async patterns, and XSS protection via `escapeHtml()`. However, there are **6 critical issues** spanning security vulnerabilities, a hard-coded network security policy that breaks all non-whitelisted server IPs, authentication bypass scenarios, and session management bugs. The most severe finding is that the Android network security config restricts cleartext HTTP to a single hardcoded IP (`84.235.249.239`), making the app non-functional with any user-configured server.

---

## Critical Issues

### CR-01: PIN stored in plaintext in Preferences and transmitted over cleartext HTTP on every request

**File:** `mobile/src/auth.js:71`, `mobile/src/api.js:19`, `mobile/src/api.js:15-26`

**Issue:** The PIN is stored in plaintext in Capacitor Preferences under the key `accessPin` (auth.js line 71). This raw PIN is then read back and sent as the `x-access-pin` HTTP header on **every authenticated API request** (api.js `getAuthHeaders()` lines 15-26, used by `getEntries()`). All network traffic uses HTTP (config.js line 28), meaning the PIN is transmitted in plaintext repeatedly with zero encryption. On Android, Capacitor Preferences uses SharedPreferences (unencrypted XML in app private directory), and `android:allowBackup="true"` in the manifest means this data could be included in cloud backups.

Beyond the plaintext storage issue, sending the raw PIN as a Bearer-equivalent token means:
- Every API call exposes the credential to MITM attack
- The PIN is logged by intermediate proxies, server access logs, and potentially HTTP request loggers
- There is no session token rotation — the PIN is sent indefinitely

**Fix:** Replace the PIN-as-token pattern with a server-issued session token. On successful PIN verification, the server should return a short-lived JWT or opaque session token. Store only the session token (not the PIN) in Preferences. The `x-access-pin` header should be removed from all non-auth requests. The bcrypt hash (`pinHash`) is fine for offline verification and does not need to change.

```js
// In auth.js — after PIN verification succeeds:
const { token, company_name, tenant_id } = result.data;
await Preferences.set({ key: 'sessionToken', value: token });
await Preferences.set({ key: 'companyName', value: company_name || '' });

// In api.js — getAuthHeaders sends session token, not PIN:
export async function getAuthHeaders() {
  const { value: sessionToken } = await Preferences.get({ key: 'sessionToken' });
  const headers = {};
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  return headers;
}
```

---

### CR-02: Network security config hardcodes a single cleartext IP — all other server IPs silently fail

**File:** `mobile/android/app/src/main/res/xml/network_security_config.xml:4-6`

**Issue:** The network security config allows cleartext HTTP **only** to IP `84.235.249.239` and blocks cleartext to all other hosts via `<base-config cleartextTrafficPermitted="false" />`. The app's settings screen allows users to configure an arbitrary server IP, but Android's network security policy will block all HTTP requests to any IP other than the whitelisted one. This means:

- The default IP `10.0.2.2` (shown in the setup overlay for emulator usage) will **always** fail with no clear error
- Any user-entered server IP will produce silent network failures that look like "Server unreachable"
- The app is effectively locked to a single production server
- Debugging and testing with different servers is impossible without recompiling

The `usesCleartextTraffic="true"` in AndroidManifest.xml does not override the network security config — the config is the effective policy.

**Fix:** Remove the IP-specific domain config and either use `usesCleartextTraffic="true"` alone, or use a certificate-based approach for production. If cleartext to arbitrary IPs is required (reasonable for a LAN-based stock app), the `network_security_config.xml` should not restrict by domain:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
```

Or remove the `networkSecurityConfig` attribute from AndroidManifest and rely on `usesCleartextTraffic="true"`.

---

### CR-03: `_verifyOffline` grants full access when no PIN hash exists (authentication bypass)

**File:** `mobile/src/auth.js:39-44`

**Issue:** The `_verifyOffline` function checks whether a `pinHash` exists in Preferences. If no hash exists (`!storedHash`), it returns `{ ok: true }` with empty credentials for **any PIN entered**. This means:

1. After `clearSession()` is called (which removes `pinHash`), any subsequent offline PIN attempt succeeds regardless of what the user types.
2. On a fresh install where the device is offline, any PIN is accepted.
3. The `verifyPin()` function falls back to `_verifyOffline()` when `isConnected()` returns false OR when the API call throws (e.g., network timeout). So the bypass is reachable through normal error recovery.

**Fix:** When no `pinHash` is stored, `_verifyOffline` must return failure instead of automatically authenticating:

```js
async function _verifyOffline(pin) {
  const { value: storedHash } = await Preferences.get({ key: 'pinHash' });
  if (!storedHash) {
    return { ok: false, error: 'offline_no_session' };
  }
  const match = bcrypt.compareSync(pin, storedHash);
  if (match) {
    // ... existing logic
  }
  return { ok: false, error: 'invalid_pin' };
}
```

---

### CR-04: `signOut()` does not clear `pinHash`, `companyName`, or `tenantId` — partial session cleanup

**File:** `mobile/src/auth.js:96-100`

**Issue:** `signOut()` removes only `accessPin` and `BIOMETRIC_ENABLED_KEY` from Preferences. It does **not** remove `pinHash`, `companyName`, or `tenantId`. This means:

1. The user's `pinHash` persists after sign-out. If the device goes offline and the user (or anyone) enters the old PIN, `_verifyOffline` will authenticate them using the stale hash.
2. `companyName` and `tenantId` persist, leaking session metadata.
3. This is inconsistent with `clearSession()` (line 87-94), which correctly clears all keys.

The `signOut()` function is the one called from the Settings screen (settings.js line 56), so this is the primary user-facing logout path.

**Fix:** `signOut()` should call `clearSession()` to ensure all session data is wiped:

```js
export async function signOut() {
  await clearSession();
}
```

Or, if the separation is intentional, add explicit removes for the missing keys:

```js
export async function signOut() {
  await Preferences.remove({ key: 'accessPin' });
  await Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
  await Preferences.remove({ key: 'pinHash' });
  await Preferences.remove({ key: 'companyName' });
  await Preferences.remove({ key: 'tenantId' });
  _notify({ isAuthenticated: false, companyName: '', tenantId: '' });
}
```

---

### CR-05: Biometric auth bypasses session state initialization — `_isAuthenticated` remains `false`

**File:** `mobile/src/auth.js:102-134`, `mobile/src/main.js:273-278`

**Issue:** When biometric authentication succeeds on app resume (main.js lines 275-278), `tryBiometricAuth()` returns `{ ok: true }` and the PIN gate is hidden. However, `tryBiometricAuth()` never calls `_notify({ isAuthenticated: true, ... })`, so:

- The module-level `_isAuthenticated` flag remains `false`
- The `onAuthChange` subscriber callback is never triggered
- `switchTab('dashboard')` is never called after biometric unlock
- The user sees whatever view was last visible without a proper data refresh
- Any code relying on `isAuthenticated()` returns incorrect state

This creates an inconsistent app state where the user has passed biometric verification but the auth system believes they are unauthenticated.

**Fix:** `tryBiometricAuth()` should establish the authenticated session state after successful biometric verification, either by retrieving the stored session data or by calling `_notify`:

```js
// In auth.js tryBiometricAuth() — after successful authenticate():
await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'true' });
const { value: companyName } = await Preferences.get({ key: 'companyName' });
const { value: tenantId } = await Preferences.get({ key: 'tenantId' });
_notify({ isAuthenticated: true, companyName: companyName || '', tenantId: tenantId || '' });
return { ok: true };
```

And in `main.js` appStateChange handler, trigger tab switch after biometric success:

```js
if (bioResult.ok) {
  hidePinGate();
  await switchTab('dashboard');
  return;
}
```

---

### CR-06: Race condition — `showDashboard()` called twice on PIN auth (duplicate API fetch)

**File:** `mobile/src/main.js:127-134`, `mobile/src/auth.js:30-36`, `mobile/src/auth.js:76`

**Issue:** When PIN verification succeeds in `handlePinSubmit()` (main.js line 127-134), two code paths both call `showDashboard()`:

1. **Direct path:** `handlePinSubmit()` calls `showDashboard()` (line 133, not awaited)
2. **Subscriber path:** `verifyPin()` calls `_notify()` (auth.js line 76) synchronously, which invokes the auth subscriber (main.js line 264-271) that calls `await switchTab('dashboard')` → `showDashboard()`

These run concurrently. Both call `loadDashboard()` → `getEntries()`, resulting in **two simultaneous API requests** for the same data. The second response overwrites the first, causing redundant network traffic and a race condition on the `_entries` and `_balances` module state.

**Fix:** Remove the explicit `showDashboard()` call from `handlePinSubmit()` and let the auth subscriber handle view switching:

```js
// In main.js handlePinSubmit():
if (result.ok) {
  hidePinGate();
  // Do NOT call showDashboard() here — auth subscriber handles it
  return;
}
```

---

## Warnings

### WR-01: `entry.quantity` concatenation risk in `getBalances()` — string type causes wrong arithmetic

**File:** `mobile/src/balances.js:19,22`

**Issue:** The `+=` operator on `current.inQty` and `current.outQty` performs string concatenation if `entry.quantity` is a string. Starting from `0` (number), `0 += "5"` produces `"05"` (string), and subsequent `"05" += "3"` produces `"053"`. This corrupts all derived values (balance, value) silently.

While JSON API responses typically return numbers for numeric fields, the code performs no runtime validation. If the API changes, returns stringified numbers, or if data comes from a different source, all stock calculations break.

**Fix:** Coerce `entry.quantity` to a number before arithmetic:

```js
const qty = Number(entry.quantity) || 0;
if (entry.type === 'in') {
  current.inQty += qty;
  current.latestRate = Number(entry.rate) || 0;
} else {
  current.outQty += qty;
}
```

---

### WR-02: `JSON.parse()` on cached data without try/catch — corrupted cache crashes dashboard

**File:** `mobile/src/dashboard.js:75`

**Issue:** When the API request fails and the code falls back to cache, `JSON.parse(cached)` is called without a try/catch wrapper. If the cached data in Preferences is corrupted (partial write, tampering, schema change), `JSON.parse` throws a `SyntaxError` that propagates as an unhandled promise rejection, crashing the dashboard loading flow. The user sees a broken state with no error recovery.

**Fix:** Wrap the parse in try/catch:

```js
if (cached) {
  try {
    _entries = JSON.parse(cached);
  } catch {
    _entries = [];
    await Preferences.remove({ key: CACHE_KEY });
    await Preferences.remove({ key: TS_KEY });
    showErrorMessage('Cached data corrupted. Please refresh.');
    return { ok: false, error: 'cache_corrupted' };
  }
  // ...
}
```

---

### WR-03: `hideDashboard()` cleanup never called on tab switch — timers leak across views

**File:** `mobile/src/main.js:30-63`

**Issue:** The `switchTab()` function hides all view containers but never calls the cleanup functions (`hideDashboard`, `hideRateCheck`, `hideSettings`). This means:

- Dashboard's `_debounceTimer` and `_staleBannerTimer` continue running after switching to Rate Check or Settings
- The stale-data banner will auto-hide even when the user isn't looking at the dashboard
- Rate check's `_debounceTimer` continues running in the background
- Settings' `_healthTimer` runs after navigating away

The `hideRateCheck` and `hideSettings` functions are imported but never called. `hideDashboard` is not even imported.

**Fix:** Call cleanup functions when switching tabs:

```js
async function switchTab(tabName) {
  // Hide all views
  const views = ['dashboard-view', 'ratecheck-view', 'settings-view'];
  views.forEach((id) => document.getElementById(id)?.classList.add('hidden'));

  // Cleanup hidden views
  hideDashboard();
  hideRateCheck();
  hideSettings();

  // Show selected view
  // ... rest of function
}
```

---

### WR-04: `handleSessionExpiry` imported but never called — dead code/reachability gap

**File:** `mobile/src/main.js:4`

**Issue:** `handleSessionExpiry` is imported from `auth.js` but never referenced anywhere in `main.js`. This function is intended to be the session expiration handler, but no code path calls it. The `checkSessionTimeout()` function (which is used) only checks whether `pinHash` exists — it doesn't trigger any session expiry action when the session is truly expired.

**Fix:** Either remove the dead import, or integrate `handleSessionExpiry` into the session timeout detection path:

```js
// In main.js appStateChange handler:
const timeout = await checkSessionTimeout();
if (timeout.expired) {
  await handleSessionExpiry();
  showSessionExpired('Session expired');
}
```

---

### WR-05: Duplicate `escapeHtml()` implementation — duplicated code

**File:** `mobile/src/dashboard.js:29-35`, `mobile/src/ratecheck.js:8-14`

**Issue:** The same `escapeHtml()` function is defined identically in two modules. This creates maintenance burden — if one is updated to handle more characters (e.g., `'` for single quotes), the other becomes inconsistent.

**Fix:** Extract to a shared utility module:

```js
// src/utils.js
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

### WR-06: ServerConfig native plugin has no Java/Kotlin implementation in the source tree

**File:** `mobile/src/config.js:5`, `mobile/android/app/proguard-rules.pro:2`

**Issue:** The `ServerConfig` plugin is registered via `registerPlugin('ServerConfig')` and referenced in ProGuard rules at `com.zestok.mobile.ServerConfigPlugin`. However, no Java or Kotlin source file implementing this plugin exists in the `mobile/android/` directory tree. The try/catch in `getNativeConfig()` silently catches the error and returns defaults, meaning:

- The native config path is effectively dead code
- `getServerConfig()` always falls through to either the saved IP or the `VITE_API_URL` fallback
- `appSecret` from native config is always `null`

This may be intentional (the plugin might be added later), but the dead code and silent failure obscure the missing implementation.

**Fix:** Either implement the native `ServerConfigPlugin.java`, or remove the plugin registration and ProGuard rule if it's not needed.

---

### WR-07: `settings.js` uses `innerHTML` for status display — no injection risk (hardcoded strings) but inconsistent with the rest of the app

**File:** `mobile/src/settings.js:75,80,89,92`

**Issue:** `updateHealthStatus()` uses `statusEl.innerHTML = '<span>Connected</span>'` with hardcoded strings (no user data), so there's no XSS risk. However, the rest of the app uses `textContent` for DOM text updates, making this an inconsistent pattern that could lead to future injection bugs if someone interpolates dynamic data into these strings.

**Fix:** Use `textContent` and create elements programmatically, or consistently document when `innerHTML` is acceptable:

```js
statusEl.textContent = 'Checking...';
statusEl.className = '';
```

---

### WR-08: Rate-limit countdown hardcoded to 5 seconds — no server-specified retry-after

**File:** `mobile/src/main.js:141`

**Issue:** When the server returns HTTP 429 (rate limited), the app imposes a hardcoded 5-second cooldown. The server's `Retry-After` header (if any) is ignored. If the server enforces a longer cool-down period, the app unblocks too early and the next request will also be rejected.

**Fix:** Read the `Retry-After` header from the API response when status is 429:

```js
// In auth.js verifyPin():
if (result.status === 429) {
  return { ok: false, error: 'rate_limited', retryAfter: result.data?.retryAfter || 5 };
}

// In main.js:
const waitSeconds = result.retryAfter || 5;
```

---

### WR-09: PIN input silently ignores <4 digit entry with no user feedback

**File:** `mobile/src/main.js:119`

**Issue:** `if (!pin || pin.length < 4) return;` silently returns without showing any error message when the user submits fewer than 4 digits. The user presses Enter/submit and nothing happens — no visual feedback, no shake animation, no error text.

**Fix:** Show an error message indicating the minimum PIN length:

```js
if (!pin || pin.length < 4) {
  pinError.textContent = 'PIN must be at least 4 digits';
  pinError.className = 'pin-error';
  pinInput.classList.add('shake');
  setTimeout(() => pinInput.classList.remove('shake'), 400);
  return;
}
```

---

### WR-10: `enableBackup="true"` in AndroidManifest — Preferences data (including PIN artifacts) could be backed up

**File:** `mobile/android/app/src/main/AndroidManifest.xml:5`

**Issue:** The manifest sets `android:allowBackup="true"`, which allows Android to back up app data (including SharedPreferences used by Capacitor Preferences) to Google Drive. Although the raw PIN is already a concern (CR-01), backup makes the exposure persistent across device restores. Even `pinHash`, `companyName`, and `tenantId` should not be backed up as they contain session credentials.

**Fix:** Either set `android:allowBackup="false"` or use `android:fullBackupContent` to exclude sensitive data:

```xml
<application
    android:allowBackup="false"
    ...
```

---

## Info

### IN-01: Dead imports in `main.js`

**File:** `mobile/src/main.js:4,6,9`

Several imports are unused or redundant:
- `handleSessionExpiry` from `./auth.js` (line 4) — never called
- `formatRate`, `formatQty` from `./dashboard.js` (line 9) — never used in main.js
- `signOut` is imported on a separate line (line 6) instead of being merged into the existing `./auth.js` import (line 4)

Remove unused imports and consolidate:

```js
import { getHealth } from './api.js';
import { App } from '@capacitor/app';
import { initConnectivity, isConnected, onStatusChange } from './connectivity.js';
import { verifyPin, onAuthChange, checkSessionTimeout, tryBiometricAuth, signOut } from './auth.js';
import { showDashboard, loadDashboard, getBalancesState } from './dashboard.js';
import { showSettings, hideSettings } from './settings.js';
import { getSavedServerIp, setServerIp } from './config.js';
import { showRateCheck, hideRateCheck } from './ratecheck.js';
```

---

### IN-02: `getNetworkStatus()` exported but never used

**File:** `mobile/src/connectivity.js:10-12`

`getNetworkStatus()` is exported but never imported by any module. Consider removing or adding a TODO for future use.

---

### IN-03: Magic numbers throughout the codebase

Several magic numbers should be extracted to named constants:

| File | Line | Value | Description |
|------|------|-------|-------------|
| `src/api.js` | 4 | `10000` | API timeout (ms) |
| `src/auth.js` | 68 | `6` | bcrypt salt rounds |
| `src/main.js` | 141 | `5` | Rate limit cooldown (seconds) |
| `src/main.js` | 111 | `5000` | Session expired banner duration (ms) |
| `src/dashboard.js` | 98 | `5000` | Stale data banner duration (ms) |
| `src/main.js` | 234 | `10.0.2.2` | Default emulator IP |
| `src/config.js` | 28 | `3000` | Hardcoded API port |

The hardcoded port (3000) is particularly limiting — the user can only configure the IP, not the port. If the server runs on a different port, the app is non-functional without a code change.

---

### IN-04: bcrypt salt rounds set to 6 — weak but acceptable for PIN UX

**File:** `mobile/src/auth.js:68`

`bcrypt.genSaltSync(6)` produces only 64 iterations (2^6). Modern recommendation is 10-12 rounds (1024-4096 iterations). For a mobile app verifying PINs, higher rounds would cause noticeable UI delay. Acceptable trade-off given the PIN is short (4-6 digits) and the hash is only used for offline verification, but worth documenting.

---

### IN-05: Date comparison for "today's movement" may have timezone mismatch

**File:** `mobile/src/dashboard.js:42-44`

`new Date().toISOString().slice(0, 10)` gives the client-local date converted to UTC. If the server stores entry dates in a different timezone (e.g., PKT, UTC+5), the "today" boundary may be offset by up to 24 hours, causing today's movement to include or exclude entries incorrectly.

---

### IN-06: `showDashboard()` not awaited in either call site

**File:** `mobile/src/main.js:58,133`

`showDashboard()` returns a Promise (it `await`s `loadDashboard()`), but both callers (`switchTab` at line 58 and `handlePinSubmit` at line 133) do not `await` the result. Errors in `loadDashboard` or `JSON.parse` become unhandled promise rejections.

---

### IN-07: Redundant timer tracking in `debounce()` function

**File:** `mobile/src/dashboard.js:146-154`

The `debounce()` function creates both a local `timer` variable and uses the module-level `_debounceTimer`. Both refer to the same timeout ID, making the local `timer` redundant. Clean up:

```js
function debounce(fn, ms = 300) {
  return (...args) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => fn(...args), ms);
  };
}
```

---

### IN-08: Capacitor server.cleartext override available — network_security_config may be sufficient alone

**File:** `mobile/capacitor.config.ts:8`

The Capacitor config has `server.cleartext: true` and the Android manifest has `usesCleartextTraffic="true"` AND a `networkSecurityConfig`. With `network_security_config.xml` in place restricting cleartext to a single IP, the broad `cleartext: true` setting in Capacitor config is actually more permissive than the effective Android policy. There are three layers with potentially conflicting intent — only one should be the source of truth.

---

_Reviewed: 2026-07-13T14:00:00Z_
_Reviewer: gsd-code-reviewer (standard depth)_
_Depth: standard_
