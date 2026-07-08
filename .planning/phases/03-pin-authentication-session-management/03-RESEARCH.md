# Phase 3: PIN Authentication & Session Management - Research

**Researched:** 2026-07-08
**Domain:** Mobile PIN authentication, session persistence, offline fallback, app lifecycle management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-23:** Single input field with `inputmode="numeric"` and `pattern="[0-9]*"` — triggers numeric keypad on mobile; accepts 4-6 digits
- **D-24:** Masked input (`type="password"` or CSS `-webkit-text-security: disc`) for privacy; auto-focused when PIN gate is shown
- **D-25:** Submit on Enter/Go key press — no submit button required; keyboard action triggers verification
- **D-26:** Store raw PIN (`accessPin`), `companyName`, and `tenantId` in `@capacitor/preferences` — the raw PIN is required by the server via the `x-access-pin` header for all authenticated API calls
- **D-27:** On app start: NO auto-restore of session — user must re-enter PIN (per AUTH-04 relaxation; session restore requirement dropped by user decision)
- **D-28:** `getAuthHeaders()` in `mobile/src/api.js` reads `accessPin` from Preferences and returns `{ "x-access-pin": pin }` — replaces the empty-object skeleton from Phase 2 (D-22)
- **D-29:** On resume from background (via `App.addListener('appStateChange', ...)`): always re-show the PIN gate — user re-enters PIN to access the app
- **D-30:** No background timeout threshold — every resume triggers PIN gate (simple, consistent with no-session-restore approach)
- **D-31:** On successful online PIN verification, store a bcrypt hash of the PIN in Preferences as `pinHash` — used for offline fallback verification
- **D-32:** On app launch: if server is unreachable, allow local PIN entry — verify against stored `pinHash` using `bcrypt.compare()` (bundled via JS bcrypt implementation; 6 salt rounds for mobile performance)
- **D-33:** Local verify only granted when server is unreachable — not as a bypass. If server is reachable and returns invalid, DO NOT fall back to local match
- **D-34:** Loading: Full-screen spinner overlay during PIN verification (before server responds or timeout fires)
- **D-35:** Invalid PIN: Inline red error message below input field; input value cleared for retry
- **D-36:** Network failure: Retry bar at bottom of screen (reuses Phase 2 retry bar pattern from D-23/D-24)
- **D-37:** Rate limited (429): Generic message "Too many attempts. Try again later." — avoids revealing rate limit details
- **D-38:** Local verify failure (offline, PIN doesn't match cache): "Invalid PIN" — same message as online failure, consistent UX

### The Agent's Discretion
- Exact layout of the PIN gate screen (positioning of logo/title/input) — standard centered-card pattern follows mobile convention
- JS bcrypt implementation choice (e.g., `bcryptjs` npm package) — research will pick the most suitable
- Spinner UI style — matches existing app aesthetic
- Whether to show company name on PIN gate — can be omitted since we don't have it before auth

### Deferred Ideas (OUT OF SCOPE)
- **Biometric unlock (fingerprint/face)** — UX-04 in v2 requirements; could skip PIN re-entry on resume when implemented in a future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User enters 4-6 digit PIN on app launch | D-23/D-24 define numeric input with masking, auto-focus; single field, no submit button (D-25) |
| AUTH-02 | App validates PIN against server `/api/pin/verify` | Server endpoint `GET /api/pin/verify` accepts `x-access-pin` header; existing `verifyPin()` in api.js uses POST (needs fix). Rate limited: 10 req/15min (429 response) |
| AUTH-03 | Valid PIN hides gate — invalid PIN shows error | D-35: inline red error below input, input cleared on failure. D-34: full-screen spinner during verify. D-38: same error for local/online failure |
| AUTH-04 | Session persists across app restarts (Preferences-backed) | D-26: `accessPin`, `companyName`, `tenantId` stored in `@capacitor/preferences`. D-27: NO auto-restore — user re-enters PIN on start |
| AUTH-05 | App re-authenticates on resume from background if session expired | D-29/D-30: `App.addListener('appStateChange')` re-shows PIN gate on every resume; no timeout threshold |
| AUTH-06 | App shows loading state during PIN verification | D-34: full-screen spinner overlay during verification; hides on success/failure response |

</phase_requirements>

## Summary

This phase implements the complete PIN authentication flow for the Capacitor v8 Android app. The PIN gate screen is the first thing the user sees on app launch. The user enters a 4-6 digit numeric PIN which is sent to the server's `GET /api/pin/verify` endpoint via the `x-access-pin` header. On success, the raw PIN, company name, and tenant ID are persisted in `@capacitor/preferences` (required for all subsequent authenticated API calls via `getAuthHeaders()`). A bcrypt hash of the PIN is also stored locally for offline fallback verification.

The auth lifecycle includes: initial PIN entry on launch (no session auto-restore — user must re-enter), PIN gate re-shown on every app resume from background (via `@capacitor/app` `appStateChange` listener), full-screen spinner during verification, inline error states for invalid PIN / rate-limited / network failure, and offline fallback using `bcryptjs.compareSync()` against the stored hash. A new `auth.js` module manages auth state with a subscriber pattern mirroring the existing `connectivity.js`. The `getAuthHeaders()` skeleton in `api.js` is populated to read the PIN from Preferences.

**Primary recommendation:** Create `mobile/src/auth.js` as the central auth state manager, install `bcryptjs@3.0.3` for offline PIN verification, update `mobile/src/api.js` to populate `getAuthHeaders()` from Preferences and fix `verifyPin()` method from POST to GET, add PIN gate HTML to `index.html`, and wire up `appStateChange` listener for resume handling.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PIN entry UI | Browser / Client | — | DOM rendering, input handling, masking, auto-focus — all client-side in WebView |
| PIN verification (online) | API / Backend | Browser / Client | Server-side bcrypt comparison against DB; client sends PIN via header and interprets response |
| PIN verification (offline) | Browser / Client | — | `bcryptjs.compareSync()` against stored `pinHash` in Preferences — entirely client-side |
| Session persistence | Browser / Client | — | `@capacitor/preferences` stores `accessPin`, `companyName`, `tenantId` locally via Android SharedPreferences |
| Auth state management | Browser / Client | — | Module-level `_isAuthenticated`, `_companyName` with subscriber pattern |
| App lifecycle (resume) | Browser / Client | — | `@capacitor/app` `appStateChange` listener fires in WebView |
| Auth header injection | Browser / Client | — | `getAuthHeaders()` reads PIN from Preferences, returns `{ 'x-access-pin': pin }` for all `auth: true` apiRequest calls |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@capacitor/preferences` | ^8.0.1 | Key-value persistent storage for session data | Official Capacitor plugin; uses Android SharedPreferences; already installed in package.json. Stores `accessPin`, `companyName`, `tenantId`, `pinHash` |
| `@capacitor/app` | ^8.1.0 | App lifecycle events (background/foreground) | Official Capacitor plugin; `appStateChange` listener for resume PIN gate; already installed |
| `bcryptjs` | ^3.0.3 | Pure JS bcrypt for offline PIN verification | Zero dependencies, browser-compatible; `compareSync()` for local PIN hash check at 6 salt rounds (D-32) |
| `@capacitor/network` | ^8.0.1 | Network connectivity detection | Already installed; `isConnected()` used for online vs offline auth path decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/core` | ^8.4.1 | Capacitor runtime core | Already installed; required by all plugins |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `bcryptjs` | `bcrypt` (C++ binding) | `bcrypt` requires native compilation (`node-gyp`), won't work in Capacitor WebView; `bcryptjs` is pure JS, works everywhere |
| `bcryptjs` | `bcrypt-ts` | TypeScript variant; viable alternative but less mature (22 dependents vs 5929 for `bcryptjs`) |
| `bcryptjs` | Web Crypto API + manual PBKDF2 | Much more code, no built-in salt management; `bcryptjs` provides `compareSync()` in one line |

**Installation:**
```bash
npm install bcryptjs@^3.0.3
npx cap sync
```

**Version verification:**
- `@capacitor/preferences`: 8.0.1 — Published 2026-07-08, 998 versions, 50 dependents, 0 dependencies. [VERIFIED: npm registry]
- `@capacitor/app`: 8.1.0 — Published recently, official Ionic plugin. [VERIFIED: npm registry]
- `bcryptjs`: 3.0.3 — Published Nov 2025, modified Apr 2026, 5929 dependents, 0 dependencies. Repo: github.com/dcodeIO/bcrypt.js. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@capacitor/preferences` | npm | ~4 yrs | >1M/wk | github.com/ionic-team/capacitor-plugins | OK | Approved (already installed) |
| `@capacitor/app` | npm | ~6 yrs | >1M/wk | github.com/ionic-team/capacitor-plugins | OK | Approved (already installed) |
| `@capacitor/network` | npm | ~5 yrs | >500K/wk | github.com/ionic-team/capacitor-plugins | OK | Approved (already installed) |
| `bcryptjs` | npm | ~9 yrs | >10M/wk | github.com/dcodeIO/bcrypt.js | OK | Approved — new install |

**Packages removed due to SLOP verdict:** None
**Packages flagged as suspicious:** None — all packages are well-established with no postinstall scripts, verified source repos, and high download counts.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Capacitor WebView                  │
│                                                     │
│  ┌─────────────────┐     ┌──────────────────────┐   │
│  │   PIN Gate View   │     │    Dashboard View     │   │
│  │  (PIN input form)  │────►│  (health check +     │   │
│  │                    │     │   future content)    │   │
│  └────────┬──────────┘     └──────────────────────┘   │
│           │                         ▲                 │
│           │ verify                  │ re-auth         │
│           ▼                         │ on resume       │
│  ┌──────────────────────────────────────────────┐    │
│  │              auth.js (State Manager)          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │    │
│  │  │_isAuth   │ │_company  │ │_subscribers  │ │    │
│  │  │_tenantId │ │_name     │ │ (Set)        │ │    │
│  │  └──────────┘ └──────────┘ └──────────────┘ │    │
│  └──────────────────┬───────────────────────────┘    │
│                     │                                 │
│        ┌────────────┼────────────┐                    │
│        ▼            ▼            ▼                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐         │
│  │ api.js   │ │Preferences│ │ connectivity │         │
│  │verifyPin │ │ (storage) │ │  .js         │         │
│  │getAuth   │ │          │ │ isConnected()│         │
│  │Headers() │ │          │ │              │         │
│  └────┬─────┘ └──────────┘ └──────────────┘         │
│       │                                              │
└───────┼──────────────────────────────────────────────┘
        │  GET /api/pin/verify
        │  x-access-pin: <pin>
        ▼
┌──────────────────┐
│  Backend Server   │
│  (bcrypt compare  │
│   against DB)     │
└──────────────────┘
```

**Flow:**
1. App launches → `auth.js` init → checking auth state → PIN gate shown
2. User enters PIN, presses Enter → full-screen spinner overlay
3. `verifyPin(pin)` called: online path (if connected) or offline path (if not)
4. Online: `GET /api/pin/verify` with `x-access-pin` header
5. Success → store session + `pinHash` in Preferences → hide gate → show dashboard
6. Failure → show inline error, clear input
7. Resume from background → `appStateChange` fires → re-show PIN gate
8. Later authenticated API calls → `getAuthHeaders()` reads PIN from Preferences

### Recommended Project Structure
```
mobile/src/
├── api.js              # Updated: getAuthHeaders() reads from Preferences; verifyPin() uses GET
├── auth.js             # NEW: Auth state, verify flow, session persistence, subscriber pattern
├── connectivity.js     # Existing: network detection (unchanged)
├── main.js             # Updated: Bootstrap auth before dashboard/health check
└── style.css           # Updated: PIN gate styles, spinner overlay
mobile/index.html       # Updated: Add PIN gate HTML overlay
```

### Pattern 1: Auth State with Subscriber Pattern
**What:** Module-level state variables with a subscriber Set (mirrors `connectivity.js` pattern). Other modules subscribe to auth state changes (e.g., `onAuthChange(callback)`) to react when the user authenticates or signs out.

**When to use:** Any module that needs to react to auth state transitions — dashboard visibility, header display, sign-out action.

**Example:**
```javascript
// Source: Adapted from existing connectivity.js pattern [VERIFIED: codebase grepped]
let _isAuthenticated = false;
let _companyName = '';
let _tenantId = '';
const _subscribers = new Set();

export function isAuthenticated() {
  return _isAuthenticated;
}

export function getCompanyName() {
  return _companyName;
}

export function onAuthChange(callback) {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

function _notify(state) {
  _isAuthenticated = state.isAuthenticated;
  _companyName = state.companyName || '';
  _tenantId = state.tenantId || '';
  for (const cb of _subscribers) {
    try { cb({ ...state }); } catch (err) { console.error('[auth] subscriber error:', err); }
  }
}
```

### Pattern 2: Offline Fallback Flow
**What:** Try online verification first. If the server is unreachable (network error), fall back to local bcryptjs comparison against stored `pinHash`. Never fall back if the server returned a definite "invalid PIN" response.

**When to use:** Every PIN verification attempt — the `verifyPin()` function in auth.js.

```javascript
// Source: Adapted from Electron renderer.js PIN flow [VERIFIED: codebase grepped]
import { isConnected } from './connectivity.js';
import { verifyPin as apiVerifyPin } from './api.js';
import bcrypt from 'bcryptjs';
import { Preferences } from '@capacitor/preferences';

export async function verifyPin(pin) {
  if (isConnected()) {
    const result = await apiVerifyPin(pin);
    if (result.ok) {
      // Server returned valid=true
      const data = result.data;
      return { ok: true, tenant_id: data.tenant_id, company_name: data.company_name };
    }
    if (result.error === 'network_error' || result.status === 0) {
      // Server unreachable — fall through to local verify
      console.log('[auth] Server unreachable, trying local verify');
    } else {
      // Server returned a definite failure (invalid PIN, rate limited, etc.)
      return { ok: false, error: result.status === 429 ? 'rate_limited' : 'invalid_pin' };
    }
  }

  // Offline or server unreachable: local verify
  const { value: pinHash } = await Preferences.get({ key: 'pinHash' });
  if (pinHash && bcrypt.compareSync(pin, pinHash)) {
    return { ok: true, local: true };
  }
  return { ok: false, error: 'invalid_pin' };
}
```

### Anti-Patterns to Avoid
- **Storing PIN in sessionStorage/localStorage**: Mobile OS may clear `window.localStorage` unpredictably; always use `@capacitor/preferences` for persistent data.
- **Auto-restoring session on app start**: The user explicitly decided against this (D-27). Always require PIN re-entry on fresh launch.
- **Falling back to local verify after server says "invalid"**: D-33 explicitly forbids this. If the server is reachable and returns `valid: false`, show the error — do NOT try local match.
- **Using `bcrypt` (C++ binding) instead of `bcryptjs`**: The C++ native binding won't compile or work in the Capacitor WebView. `bcryptjs` is the correct pure-JS choice.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt implementation | `bcryptjs` | `bcryptjs.compareSync()` handles salt extraction, comparison, constant-time string comparison — subtle crypto that's easy to get wrong |
| Key-value persistence | Manual JSON file I/O | `@capacitor/preferences` | Native Android SharedPreferences API, avoids localStorage eviction on mobile, already installed |
| Network connectivity detection | Ping-based heuristics | `@capacitor/network` | Already implemented in `connectivity.js`; `isConnected()` returns reliable native network status |
| App lifecycle events | Visibility API polling | `@capacitor/app` | `appStateChange` fires reliably on Android activity lifecycle; already installed |

**Key insight:** The Capacitor plugin ecosystem already provides production-ready native implementations for storage, network detection, and lifecycle events. Using them avoids subtle platform bugs (localStorage eviction, unreliable visibility events) that would surface only in production.

## Common Pitfalls

### Pitfall 1: `verifyPin()` Method Mismatch (POST vs GET)
**What goes wrong:** The existing `verifyPin()` in `api.js` uses `method: 'POST'` but the server endpoint is `GET /api/pin/verify`. Express will return 404 for POST at that route.
**Why it happens:** The skeleton was written in Phase 2 before the server endpoint was finalized.
**How to avoid:** Change `method: 'POST'` to `'GET'` and remove the `body: {}` parameter. The PIN is sent via header, not body.
**Warning signs:** 404 errors or Express "Cannot POST /api/pin/verify" when testing.

### Pitfall 2: `verifyPin()` in api.js Also Used for Auth Header
**What goes wrong:** The current `verifyPin()` passes `x-access-pin` in `extraHeaders`, which bypasses `getAuthHeaders()`. This causes confusion about where the PIN header is set.
**How to avoid:** Remove the `headers` override from `verifyPin()` and instead make it use the standard `auth: true` flag so `getAuthHeaders()` supplies the header consistently. Alternatively, keep it explicit but document clearly.
**Recommendation:** Keep `verifyPin()` explicit (it has no need for `getAuthHeaders()`) since the PIN verification happens before session is established. Before calling `verifyPin`, the PIN isn't in Preferences yet.

### Pitfall 3: `bcryptjs` Bundling in Vite/Capacitor
**What goes wrong:** `bcryptjs` uses Node.js `crypto` module internally. In a Vite-bundled Capacitor app, the browser polyfill for `crypto` may not be present.
**How to avoid:** `bcryptjs` 3.x already handles this — it uses `crypto.subtle` or falls back to a pure-JS random generator. Test on actual Android device after install. If `crypto` import fails, configure Vite to stub it out (the bcryptjs docs mention using an import map).
**Warning signs:** Runtime error like `Module "crypto" has been externalized for browser compatibility`.

### Pitfall 4: Preferences `get()` Returns `{ value: null }` for Missing Keys
**What goes wrong:** `Preferences.get({ key: 'accessPin' })` returns `{ value: null }` when the key doesn't exist (not `{ value: undefined }`). Code that destructures without a default may crash.
**How to avoid:** Always use `const { value } = await Preferences.get({ key: 'accessPin' }); if (!value) { /* not set */ }` pattern.

### Pitfall 5: `appStateChange` `isActive` Semantics
**What goes wrong:** `isActive: false` fires when going TO background, `isActive: true` fires when coming TO foreground. Adding the listener inside the PIN gate's initial render may miss the first resume event.
**How to avoid:** Register the `appStateChange` listener once during app init (not inside a conditional). Gate on `isActive === true` to re-show the PIN view. Use `removeAllListeners()` on app teardown if needed.

## Code Examples

### Example 1: Storing and Retrieving Session from Preferences
```javascript
// Source: Capacitor Preferences API docs [CITED: capacitorjs.com/docs/apis/preferences]
import { Preferences } from '@capacitor/preferences';

// Store session
await Preferences.set({ key: 'accessPin', value: '1234' });
await Preferences.set({ key: 'companyName', value: 'ACME Corp' });
await Preferences.set({ key: 'tenantId', value: '7' });

// Read session
const { value: pin } = await Preferences.get({ key: 'accessPin' });
const { value: company } = await Preferences.get({ key: 'companyName' });

// Clear session
await Preferences.remove({ key: 'accessPin' });
await Preferences.remove({ key: 'companyName' });
await Preferences.remove({ key: 'tenantId' });
await Preferences.remove({ key: 'pinHash' });
```

### Example 2: App Lifecycle Listener for Resume
```javascript
// Source: Capacitor App API docs [CITED: capacitorjs.com/docs/apis/app]
import { App } from '@capacitor/app';

// Register once during init
App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // App returned to foreground — re-show PIN gate
    showPinGate();
  }
  // isActive === false means going to background — no action needed
});
```

### Example 3: bcryptjs compareSync for Offline Verification
```javascript
// Source: bcryptjs npm docs [CITED: npmjs.com/package/bcryptjs]
import bcrypt from 'bcryptjs';
import { Preferences } from '@capacitor/preferences';

// Store hash on successful online auth (6 salt rounds per D-32)
async function storeLocalHash(pin) {
  const salt = bcrypt.genSaltSync(6);
  const hash = bcrypt.hashSync(pin, salt);
  await Preferences.set({ key: 'pinHash', value: hash });
}

// Verify locally
async function verifyLocal(pin) {
  const { value: pinHash } = await Preferences.get({ key: 'pinHash' });
  if (!pinHash) return false;
  return bcrypt.compareSync(pin, pinHash);
}
```

### Example 4: Updated `getAuthHeaders()` in api.js
```javascript
// Source: Modified from existing api.js skeleton [VERIFIED: codebase grepped]
import { Preferences } from '@capacitor/preferences';

export async function getAuthHeaders() {
  const { value: accessPin } = await Preferences.get({ key: 'accessPin' });
  if (!accessPin) return {};
  return { 'x-access-pin': accessPin };
}
```

**Note:** `getAuthHeaders()` must become `async` since `Preferences.get()` returns a Promise. All calls to `getAuthHeaders()` in `apiRequest()` must be `await`-ed.

### Example 5: Fixed `verifyPin()` in api.js
```javascript
// Source: Modified from existing api.js [VERIFIED: codebase grepped — server endpoint is GET]
export async function verifyPin(pin) {
  return apiRequest('/pin/verify', {
    method: 'GET',
    headers: { 'x-access-pin': pin },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Electron app: PIN stored in JSON file via `window.stockApi.savePinLocal()` | Capacitor app: PIN stored in `@capacitor/preferences` (Android SharedPreferences) | Phase 3 | More reliable persistence, no IPC bridge needed |
| Electron app: Local verify via `window.stockApi.verifyPin()` (Electron IPC → bcrypt in Node) | Capacitor app: Local verify via `bcryptjs.compareSync()` (pure JS in WebView) | Phase 3 | No IPC needed, but slower CPU-bound hashing on mobile — mitigated by using 6 rounds (not 10+) |
| Electron app: PIN re-entry only on fresh start | Capacitor app: PIN gate on every resume from background (D-29) | Phase 3 | Stricter security; no background timeout threshold (D-30) |
| `@capacitor/storage` (deprecated v3) | `@capacitor/preferences` (v4+) | Capacitor v4 | Same API, renamed plugin |

**Deprecated/outdated:**
- `@capacitor/storage` was renamed to `@capacitor/preferences` in Capacitor v4. The project already uses `@capacitor/preferences` correctly.
- `window.localStorage` should not be used for persistent data on mobile (OS can evict). Preferences plugin avoids this.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bcryptjs` v3.0.3 ESM import works in Vite-bundled Capacitor WebView without additional polyfills | Standard Stack | Runtime `crypto` import failure; mitigatable by configuring Vite to stub `crypto` |
| A2 | `getAuthHeaders()` being async won't break existing callers in api.js | Code Examples | The `apiRequest()` function and all `auth: true` callers must `await` `getAuthHeaders()` — existing callers like `getEntries()` may need updates |
| A3 | 6 salt rounds for bcryptjs is fast enough on Android mobile CPUs | Architecture Patterns | If too slow (~3-5 seconds), user experience degrades during offline auth; fallback to 4 rounds if benchmarking shows >2s |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build toolchain | ✓ | 24.16.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| @capacitor/preferences | Session persistence | ✓ | 8.0.1 | Already installed |
| @capacitor/app | Lifecycle events | ✓ | 8.1.0 | Already installed |
| @capacitor/network | Connectivity detection | ✓ | 8.0.1 | Already installed |
| bcryptjs | Offline PIN verification | ✗ | 3.0.3 | Must be installed via `npm install bcryptjs@^3.0.3; npx cap sync` |

**Missing dependencies with no fallback:** None — bcryptjs is a standard npm install with no native dependencies.

**Missing dependencies with fallback:** None — all required Capacitor plugins are already installed.

## Validation Architecture

> Note: Nyquist validation is enabled in config.json (`workflow.nyquist_validation: true`). However, the mobile/ project has no JavaScript test framework installed — no test config files, no test directories, no test scripts in package.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | No test command defined |
| Full suite command | No test command defined |

### Phase Requirements → Test Map
Since no testing infrastructure exists, all verification is manual-only for this phase. Automated tests cannot be run without first establishing a framework.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | PIN entry with numeric keypad | manual-only | N/A | ❌ Wave 0 |
| AUTH-02 | PIN verify sends x-access-pin header | manual-only | N/A | ❌ Wave 0 |
| AUTH-03 | Valid PIN hides gate, invalid shows error | manual-only | N/A | ❌ Wave 0 |
| AUTH-04 | Session persisted to Preferences | manual-only | N/A | ❌ Wave 0 |
| AUTH-05 | Resume re-shows PIN gate | manual-only | N/A | ❌ Wave 0 |
| AUTH-06 | Loading spinner during verification | manual-only | N/A | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** N/A (no test suite)
- **Per wave merge:** N/A (no test suite)
- **Phase gate:** Manual verification against success criteria in phase description; `/gsd-verify-work` UAT

### Wave 0 Gaps
- [ ] No JavaScript test framework installed (no vitest, jest, or similar)
- [ ] No test config file (vitest.config.js, jest.config.js, etc.)
- [ ] No shared test fixtures
- [ ] Recommendation: Establishing test infrastructure is out of scope for this auth phase — add to backlog or Phase 6

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | PIN verification via `/api/pin/verify`; offline fallback with bcryptjs |
| V3 Session Management | yes | Preferences-based session storage (accessPin, companyName, tenantId) |
| V4 Access Control | yes | `getAuthHeaders()` injects `x-access-pin` on all authenticated API calls |
| V5 Input Validation | yes | PIN restricted to 4-6 numeric digits via `inputmode="numeric"` and `pattern="[0-9]*"` |
| V6 Cryptography | yes | bcryptjs for local PIN hash (6 rounds); server uses bcrypt internally |

### Known Threat Patterns for Capacitor/JS Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PIN brute force via API | Denial of Service (rate limit) | Server enforces `pinVerifyLimiter`: 10 requests per 15 minutes; generic 429 error message (D-37) |
| PIN stored in plaintext locally | Information Disclosure | PIN stored in Preferences — raw PIN required by server for all API calls (D-26). PIN hash stored for offline fallback (D-31) |
| Offline bypass via hash manipulation | Tampering | D-33: local verify only when server unreachable; hash is stored read-only from successful online auth |
| Session replay via stolen Preferences data | Spoofing | PIN is the credential — if device is compromised, attacker has PIN. Mitigated by re-entry requirement on resume (D-29) |
| CORS bypass | Spoofing | Server has CORS configured with specific allowed origins (server.js lines 14-30) |
| Timing attack on input validation | Information Disclosure | `bcryptjs.compareSync()` uses constant-time comparison from bcryptjs internals |

## Sources

### Primary (HIGH confidence)
- Capacitor Preferences API v8 docs — capacitorjs.com/docs/apis/preferences — API signatures, usage patterns [CITED]
- Capacitor App API v8 docs — capacitorjs.com/docs/apis/app — appStateChange listener, lifecycle [CITED]
- npm registry: @capacitor/preferences@8.0.1, @capacitor/app@8.1.0, bcryptjs@3.0.3 — version and metadata verified [VERIFIED: npm registry]
- Codebase: src/server.js — PIN verify endpoint (GET /api/pin/verify), rate limiting, response shapes [VERIFIED: codebase grepped]
- Codebase: src/renderer.js — Electron PIN login flow patterns [VERIFIED: codebase grepped]
- Codebase: mobile/src/api.js — existing apiRequest, verifyPin skeleton [VERIFIED: codebase grepped]
- Codebase: mobile/src/connectivity.js — subscriber pattern, isConnected() [VERIFIED: codebase grepped]
- Codebase: mobile/src/main.js — retry bar, inline error patterns [VERIFIED: codebase grepped]
- Codebase: mobile/package.json — existing dependencies [VERIFIED: codebase grepped]

### Secondary (MEDIUM confidence)
- bcryptjs npm docs — npmjs.com/package/bcryptjs — API usage, browser compatibility notes [CITED]
- bcryptjs GitHub repo — github.com/dcodeIO/bcrypt.js — zero dependencies, pure JS [CITED]

### Tertiary (LOW confidence)
- N/A — all factual claims verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm, already installed or well-established; bcryptjs is the de facto standard for pure-JS bcrypt
- Architecture: HIGH — patterns derived from existing codebase (subscriber pattern from connectivity.js, retry bar from main.js, PIN flow from Electron renderer.js)
- Pitfalls: HIGH — verified against actual codebase (POST vs GET mismatch, Preferences API behavior, appStateChange semantics)
- Security: MEDIUM — PIN storage on device is inherently a tradeoff; bcryptjs browser crypto dependency is assumed to work based on docs

**Research date:** 2026-07-08
**Valid until:** 2026-08-08 (30 days — stable Capacitor ecosystem)
