# Phase 4: Dashboard — Metrics & Stock Table - Research

**Researched:** 2026-07-09
**Domain:** Mobile dashboard, metrics computation (porting Electron balances logic), stock table rendering, offline caching, biometric unlock
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-39:** After PIN verification, replace health check UI with dashboard layout
- **D-40:** Keep retry bar pattern from Phase 2 for transient errors
- **D-41:** 4 metric cards in 2x2 grid layout
- **D-42:** Each card shows label, value with PKR Rs format/commas, subtle icon
- **D-43:** Cache entries JSON in Preferences as `cachedEntries` + `cachedTimestamp`
- **D-44:** On dashboard open: call getEntries() API; on success write to cache; on failure read from cache
- **D-45:** Stale-data banner using same pattern as session-expired-banner pattern
- **D-46:** Cache refreshed on every successful /api/entries call
- **D-47:** Real-time client-side filter with 300ms debounce, filter by item name/category
- **D-48:** No Search button — results update instantly; clear restores full list
- **D-49:** Dismiss keyboard on tap outside search or clear field
- **D-50:** Use `@capacitor/biometric` plugin for fingerprint/face auth — **NOTE:** the actual npm package is `@aparajita/capacitor-biometric-auth` (see below)
- **D-51:** On app resume: attempt biometric first; fall back to PIN gate if unavailable/fails/cancelled
- **D-52:** Store biometricEnabled flag in Preferences; check on resume

### The Agent's Discretion
- Exact card styling (colors, icon placement) — follows existing dark theme from `style.css`
- Search input placement — above the stock table, standard pattern
- Refresh indicator (pull-to-refresh or manual button) — standard mobile pull-to-refresh is idiomatic
- Error state for dashboard data load failure — follow existing inline error and retry patterns

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard shows 4 metric cards: Total Items, Balance Qty, Stock Value, Today's Movement | Metric values computed from `getBalances()` port (Electron `renderer.js:424-453`). Total Items = balances.length. Balance Qty = sum of all item balances. Stock Value = sum of all item values. Today's Movement = filter entries by today's date. |
| DASH-02 | Values formatted with PKR currency (Rs) and comma separators | `formatRate()` from Electron uses `Intl.NumberFormat` with PKR. Identical pattern used in `renderer.js:22-26` and `renderer.js:33-37`. |
| DASH-03 | Dashboard auto-refreshes data on app open | D-44: `getEntries()` called on dashboard open; cached data served on failure via D-43/D-44. Stale-data banner (D-45) when showing cached data. |
| DASH-04 | Scrollable stock balance table with columns: Item, Category, In, Out, Balance, Rate, Value | Table rendered from `getBalances()` output. 7-column HTML table inside a scrollable container. Electron pattern at `renderer.js:515-536`. |
| DASH-05 | Search/filter bar to filter items by name or category | D-47/D-48: 300ms debounce, `keyFor()` includes-match, same pattern as `renderer.js:516-517`. |
| DASH-06 | Empty state when no data available | When balances.length === 0 (first load, no entries server-side, or offline without cache): show empty state message ("No stock data available" with retry action). Pattern from `renderer.js:535` empty-row. |
| CONN-03 | Last-known-good data cached and displayed when offline (stale indicator) | D-43 to D-46: Preferences cache with `cachedEntries` + `cachedTimestamp`. Stale-data banner (D-45) uses same CSS as `session-expired-banner`. |
| UI-02 | Touch-friendly UI with 44px+ touch targets, single-column layout | Table cells must have min-height 44px. Search input height 44px+. 2x2 grid auto-sizes with CSS Grid. Safe-area padding via `env(safe-area-inset-*)`. |
| UX-04 | Biometric unlock (fingerprint/face) | D-50 to D-52: `@aparajita/capacitor-biometric-auth` v10.0.0 for Capacitor 8. `checkBiometry()` first, then `authenticate()`. `addResumeListener()` for biometry changes on resume. |
</phase_requirements>

## Summary

Phase 4 builds the main dashboard — the primary screen users see after PIN authentication. It involves porting the `getBalances()` balance computation logic from the Electron `renderer.js` (lines 424-453) to the Capacitor mobile app, rendering 4 metric cards in a 2x2 grid, a scrollable 7-column stock balance table, and a real-time client-side search/filter bar with 300ms debounce.

The data flows through a fetch-first-then-cache pattern: on dashboard open, the app calls `GET /api/entries` (via existing `getEntries()` in `mobile/src/api.js`). On success, the response is written to `@capacitor/preferences` under `cachedEntries` + `cachedTimestamp`. On failure (offline or server error), the app reads from the cache and displays a stale-data banner using the same pattern as the session-expired banner from Phase 3.

A key new integration is biometric unlock via `@aparajita/capacitor-biometric-auth` v10.0.0 (the correct npm package — `@capacitor/biometric` does not exist). On app resume, the plugin's `checkBiometry()` checks hardware availability, and `authenticate()` prompts for fingerprint/face. On success, the app skips the PIN gate. On failure/cancellation, it falls back to the PIN gate.

**Primary recommendation:** Create `mobile/src/dashboard.js` as the dashboard state manager, install `@aparajita/capacitor-biometric-auth@^10.0.0` for biometric unlock, port `getBalances()` logic to a pure JS utility function (`mobile/src/balances.js`), update `mobile/index.html` to include dashboard markup alongside existing PIN gate, update `mobile/src/main.js` to show dashboard after PIN auth (replacing health check), and wire up the biometric resume flow.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Metric cards rendering | Browser / Client | — | 2x2 grid with DOM textContent updates, CSS layout — all client-side |
| Stock balance table rendering | Browser / Client | — | HTML table inserted into DOM; scrollable container; search filtering — all client-side |
| Balance computation (`getBalances()`) | Browser / Client | — | Pure JS reducer over entries array; no server endpoint needed |
| Data fetching (`/api/entries`) | API / Backend | Browser / Client | Server returns `{ entries: [...] }` via PostgreSQL query; client calls with auth headers |
| Offline cache management | Browser / Client | — | `@capacitor/preferences` stores/retrieves cached entries; all client-side |
| Stale-data banner | Browser / Client | — | CSS banner shown/hidden based on cache status; timer-based auto-hide (like session-expired) |
| Search/filter | Browser / Client | — | Client-side debounced filter over already-loaded balances array; `keyFor().includes()` |
| Biometric unlock | Browser / Client | — | `@capacitor/app` lifecycle + native biometric plugin; `checkBiometry()`, `authenticate()` |
| Rate check screen | — | — | Deferred to Phase 5 |
| Bottom navigation | — | — | Deferred to Phase 5 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aparajita/capacitor-biometric-auth` | ^10.0.0 | Biometric authentication (fingerprint/face) on app resume | The ONLY Capacitor 8-compatible biometric plugin with `checkBiometry()` + `authenticate()` + `addResumeListener()` — 45.6K weekly downloads, MIT license, 224 GitHub stars. Note: This is the package name — there is NO `@capacitor/biometric` package on npm. [VERIFIED: npm registry] |
| `@capacitor/preferences` | ^8.0.1 | Offline cache for entries JSON | Already installed (Phase 1). Used for `cachedEntries` + `cachedTimestamp` keys. [VERIFIED: npm registry] |
| `@capacitor/app` | ^8.1.0 | App lifecycle (resume events for biometric) | Already installed (Phase 1). `appStateChange` listener. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/network` | ^8.0.1 | Offline detection | Already installed (Phase 2). `isConnected()` for deciding online vs offline data path. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@aparajita/capacitor-biometric-auth` | `@capgo/capacitor-native-biometric` v8.6.1 | `@capgo` also supports Capacitor 8, but says "Only supports Capacitor 7" in its README (despite peerDependencies saying `>=8.0.0`). The `@aparajita` variant is explicitly documented for Capacitor 8, has a cleaner `checkBiometry()` → `authenticate()` flow, and has `addResumeListener()` built in. Both are valid but `@aparajita` is more reliable for Capacitor 8. |
| `@aparajita/capacitor-biometric-auth` | Manual PIN-only (no biometric) | User explicitly requested biometric unlock (UX-04). Not using it would fail the requirement. |

**Installation:**
```bash
npm install @aparajita/capacitor-biometric-auth@^10.0.0
npx cap sync
```

**Version verification:**
- `@aparajita/capacitor-biometric-auth`: 10.0.0 — Published 2026-02-09, 47 releases, 5 years old, 45.6K weekly downloads, MIT license, 224 stars. [VERIFIED: npm registry]
- `@capacitor/preferences`: 8.0.1 — Already installed [VERIFIED: npm registry]
- `@capacitor/app`: 8.1.0 — Already installed [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Postinstall Script | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|-------------------|---------|-------------|
| `@aparajita/capacitor-biometric-auth` | npm | ~5 yrs | 45.6K/wk | github.com/aparajita/capacitor-biometric-auth | None | [OK] | Approved — new install |
| `@capgo/capacitor-native-biometric` | npm | ~3 yrs | 92.9K/wk | github.com/Cap-go/capacitor-native-biometric | None | [OK] | Alternative — NOT selected |

**Packages removed due to SLOP verdict:** None
**Packages flagged as suspicious:** None

*Note: The CONTEXT.md decision D-50 references `@capacitor/biometric` which does NOT exist on npm. The correct package name is `@aparajita/capacitor-biometric-auth`. This is believed to be a naming shorthand in the discussion. The planner should use the correct package name.*

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     Capacitor WebView                            │
│                                                                  │
│  ┌──────────────┐     On auth success:                           │
│  │  PIN Gate    │────► hidePinGate() ───► showDashboard()        │
│  │  (overlay)   │     Replace health check UI entirely           │
│  └──────────────┘                                               │
│         ▲                                                       │
│         │ fallback if biometric fails/cancelled                  │
│         │                                                       │
│  ┌──────┴───────────┐    ┌──────────────────────────────────┐   │
│  │ Biometric Check   │    │        Dashboard View             │   │
│  │ (on app resume)   │    │  ┌──────────────────────────┐   │   │
│  │ checkBiometry()   │    │  │ Stale-data banner (if    │   │   │
│  │ → authenticate()  │    │  │ showing cached data)     │   │   │
│  └──────────────────┘    │  ├──────────────────────────┤   │   │
│                          │  │ Metric Cards (2x2 grid)  │   │   │
│                          │  │ ┌──────┐ ┌──────┐       │   │   │
│                          │  │ │Total │ │BalQty│       │   │   │
│                          │  │ │Items │ │      │       │   │   │
│                          │  │ ├──────┤ ├──────┤       │   │   │
│                          │  │ │Stock │ │Today/│       │   │   │
│                          │  │ │Value │ │Movt  │       │   │   │
│                          │  │ └──────┘ └──────┘       │   │   │
│                          │  ├──────────────────────────┤   │   │
│                          │  │ Search bar (debounced)   │   │   │
│                          │  ├──────────────────────────┤   │   │
│                          │  │ Stock Table (scrollable) │   │   │
│                          │  │ Item│Cat│In│Out│Bal│Rate│Val│   │
│                          │  └──────────────────────────┘   │   │
│                          └──────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    dashboard.js                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │    │
│  │  │_entries  │  │_balances │  │_search   │  │_cache  │ │    │
│  │  │[array]   │  │[array]   │  │Timer     │  │Status  │ │    │
│  │  └────┬─────┘  └────┬─────┘  └──────────┘  └────────┘ │    │
│  └───────┼──────────────┼─────────────────────────────────┘    │
│          │              │                                      │
│          ▼              ▼                                       │
│  ┌────────────┐  ┌────────────┐                                │
│  │  api.js    │  │ balances.js│  ┌─────────────────────────┐   │
│  │getEntries()│  │ getBalance │  │    auth.js + biometric  │   │
│  │with auth:  │  │ s(entries) │  │   integration (main.js) │   │
│  │true        │  │ → array    │  │                         │   │
│  └─────┬──────┘  └────────────┘  └─────────────────────────┘   │
│        │                                                        │
└────────┼────────────────────────────────────────────────────────┘
         │  GET /api/entries
         │  x-access-pin: <pin>
         ▼
┌──────────────────┐
│  Backend Server   │
│  SELECT id, date, │
│  type, item, cat, │
│  qty, rate ...     │
│  FROM stock_entries│
│  ORDER BY crtd_at  │
└──────────────────┘
```

**Primary Flow:**
1. App auth completes → `hidePinGate()` → `showDashboard()` called
2. `showDashboard()` → `loadDashboard()`:
   a. Call `getEntries()` via `apiRequest` with `auth: true`
   b. On success: write `cachedEntries`, `cachedTimestamp` to Preferences → compute balances via `getBalances()` → render metrics table
   c. On failure (`!isConnected()` or `network_error`): read `cachedEntries` from Preferences → show stale-data banner → compute balances → render
3. Search: user types → 300ms debounce → filter `_balances` by `keyFor()` match on item/category → re-render table rows
4. App resume: `appStateChange({ isActive: true })` → if `biometricEnabled === true`: `checkBiometry()` → `authenticate()` → skip PIN gate; fall back to PIN gate on failure/cancellation

### Recommended Project Structure
```
mobile/src/
├── api.js              # Existing: getEntries() already wired up
├── auth.js             # Existing: PIN auth from Phase 3
├── balances.js         # NEW: getBalances(entries) — pure reducer, ported from renderer.js
├── connectivity.js     # Existing: isConnected() for offline branch
├── dashboard.js        # NEW: Dashboard state, data loading, cache, subscribers
├── main.js             # Updated: On auth, showDashboard(); biometric resume flow
├── style.css           # Updated: metric cards, stock table, search, stale-data banner styles
├── index.html          # Updated: dashboard markup replacing health check <main>
```

### Pattern 1: Balance Computation (Ported from Electron)
**What:** Pure JS function that aggregates entries by item, computing in/out/balance/value per row. Ported exactly from `renderer.js:424-453`.

**When to use:** Whenever entries data is loaded (from API or cache) — produces the array that drives both metric cards and stock table.

**Example:**
```javascript
// Source: Ported from src/renderer.js:31-37, 424-453 [VERIFIED: codebase grepped]
const keyFor = (value) => String(value || '').trim().toLowerCase();

export function getBalances(entries) {
  const items = new Map();

  for (const entry of entries) {
    const itemKey = keyFor(entry.item);
    const current = items.get(itemKey) || {
      item: entry.item,
      category: entry.category || '-',
      inQty: 0,
      outQty: 0,
      balance: 0,
      latestRate: 0,
      value: 0,
    };

    if (entry.type === 'in') {
      current.inQty += entry.quantity;
      current.latestRate = entry.rate;
    } else {
      current.outQty += entry.quantity;
    }

    current.category = entry.category || current.category;
    current.balance = current.inQty - current.outQty;
    current.value = current.balance * current.latestRate;
    items.set(itemKey, current);
  }

  return Array.from(items.values()).sort((a, b) => a.item.localeCompare(b.item));
}
```

**Key insight from the Electron app:** `latestRate` is only updated on "in" type entries (the most recent "in" entry's rate becomes the current rate for value calculation). This matches the SQL `stock_balance` view pattern.

### Pattern 2: Metric Cards Computation
**When to use:** After `getBalances()` produces the balances array.

```javascript
// Source: Ported from src/renderer.js:489-501 [VERIFIED: codebase grepped]
import { formatQty, formatRate } from './formatters.js';

export function computeMetrics(balances, entries) {
  const totalItems = balances.length;
  const totalBalance = balances.reduce((sum, item) => sum + item.balance, 0);
  const stockValue = balances.reduce((sum, item) => sum + item.value, 0);

  const today = new Date().toISOString().slice(0, 10);
  const todayMovement = entries
    .filter((entry) => entry.date === today)
    .reduce(
      (sum, entry) =>
        sum + (entry.type === 'in' ? Number(entry.quantity || 0) : -Number(entry.quantity || 0)),
      0
    );

  return { totalItems, totalBalance, stockValue, todayMovement };
}
```

### Pattern 3: Offline Cache (D-43 to D-46)
**When to use:** Every dashboard data load — try API first, cache on success, read cache on failure.

```javascript
// Source: Derived from D-43 to D-46 and Phase 3 offline PIN pattern [CITED: CONTEXT.md]
import { Preferences } from '@capacitor/preferences';
import { getEntries } from './api.js';
import { isConnected } from './connectivity.js';

const CACHE_KEY = 'cachedEntries';
const TS_KEY = 'cachedTimestamp';

export async function loadEntries() {
  const result = await getEntries();

  if (result.ok && result.data?.entries) {
    // Fresh data — cache it
    await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(result.data.entries) });
    await Preferences.set({ key: TS_KEY, value: new Date().toISOString() });
    return { entries: result.data.entries, fromCache: false };
  }

  // API failed — try cache
  const { value: cached } = await Preferences.get({ key: CACHE_KEY });
  const { value: timestamp } = await Preferences.get({ key: TS_KEY });

  if (cached) {
    return {
      entries: JSON.parse(cached),
      fromCache: true,
      timestamp: timestamp || 'unknown',
    };
  }

  // No cache either
  return { entries: [], fromCache: false };
}
```

### Pattern 4: Biometric Unlock Flow (D-50 to D-52)
**When to use:** On app resume, before showing the PIN gate.

```javascript
// Source: @aparajita/capacitor-biometric-auth README API docs [CITED: github.com/aparajita/capacitor-biometric-auth]
import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { Preferences } from '@capacitor/preferences';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

export async function tryBiometricAuth() {
  // Check if biometric has been enabled (first successful use stores this flag)
  const { value: enabled } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
  if (!enabled) return { ok: false, reason: 'not_enabled' };

  // Check if biometry is available
  const biometryInfo = await BiometricAuth.checkBiometry();
  if (!biometryInfo.isAvailable) {
    return { ok: false, reason: 'unavailable', error: biometryInfo.code };
  }

  // Attempt authentication
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Stock Management',
      cancelTitle: 'Use PIN',
      allowDeviceCredential: true,
    });

    // Success — store flag for future resume attempts
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'true' });
    return { ok: true };
  } catch (error) {
    if (error instanceof BiometryError) {
      if (error.code === BiometryErrorType.userCancel) {
        // User cancelled — fall through to PIN gate
        return { ok: false, reason: 'cancelled' };
      }
      // Actual failure — fall through to PIN gate
      return { ok: false, reason: 'error', error: error.code };
    }
    return { ok: false, reason: 'error' };
  }
}
```

### Anti-Patterns to Avoid
- **Re-fetching entries on every search keystroke:** Search/filter is purely client-side. The entries are already loaded. Filtering the in-memory `balances` array with a debounce avoids unnecessary API calls.
- **Storing raw entries object without JSON serialization:** `@capacitor/preferences` stores strings, not objects. Always `JSON.stringify()` before `set()` and `JSON.parse()` after `get()`.
- **Letting stale-data banner persist forever:** Use the same auto-hide timer pattern as `session-expired-banner` (D-45 references) — show on cache load, auto-hide after 5 seconds, but the data stays visible.
- **Calling `checkBiometry()` before every resume:** Per the plugin docs, `addResumeListener()` handles this automatically. Register it once during app init.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Balance computation | Custom reducer with bugs | Port `getBalances()` from `renderer.js:424-453` | Proven code — 900+ lines of renderer.js already tested in production. Porting exactly avoids new bugs from re-derived logic. |
| Biometric auth | Manual fingerprint API integration | `@aparajita/capacitor-biometric-auth` | Native Android BiometricPrompt API wrapper — handles `onAuthenticationError`, `onAuthenticationSucceeded`, `onAuthenticationFailed` callbacks, device credential fallback, and web simulation |
| Offline storage | JSON file I/O (fs) | `@capacitor/preferences` | Already installed. Native SharedPreferences avoids filesystem permission issues on Android. |
| Currency formatting | Manual comma insertion | `Intl.NumberFormat("en-PK")` | Handles locales, decimal places, and PKR currency correctly — no regex needed. Already used in `renderer.js`. |
| Debounce | `setTimeout`/`clearTimeout` manually | `setTimeout` + `clearTimeout` in a `debounce()` utility | Simple enough not to need a library like Lodash — it's a 4-line pattern. |

## Common Pitfalls

### Pitfall 1: `@capacitor/biometric` Package Name Does Not Exist
**What goes wrong:** Decision D-50 says `@capacitor/biometric` but this package is NOT on npm (`npm view` returns 404). The correct package is `@aparajita/capacitor-biometric-auth` v10.0.0.
**Why it happens:** The user decided the package name during discussion without verifying the registry. "Capacitor biometric plugin" is commonly confused with various community plugins.
**How to avoid:** Always use `@aparajita/capacitor-biometric-auth@^10.0.0`. Install with `npm install @aparajita/capacitor-biometric-auth@^10.0.0; npx cap sync`.
**Warning signs:** Import error `Module not found: Can't resolve '@capacitor/biometric'`.

### Pitfall 2: `formatRate()` vs `formatQty()` Confusion
**What goes wrong:** Metric cards for Stock Value use PKR formatting (`formatRate()`), but Balance Qty and Today's Movement use plain number formatting (`formatQty()`). Using the wrong formatter adds "Rs" to quantity values.
**Why it happens:** The renderer.js has two separate formatters: `formatQty` uses `toLocaleString("en-PK", { maximumFractionDigits: 2 })` while `formatRate` uses the currency formatter which adds "Rs".
**How to avoid:** Follow the exact mapping from `renderer.js:489-501`:
- Total Items → `balances.length` (plain number)
- Balance Qty → `formatQty(totalBalance)` (number with commas)
- Stock Value → `formatRate(stockValue)` (Rs currency)
- Today's Movement → `formatQty(todayMovement)` (number with commas, not currency)

### Pitfall 3: Session-Expired Banner vs Stale-Data Banner Conflict
**What goes wrong:** Both use `position: fixed; top: 0` with the same animation. If both are visible simultaneously, they overlap.
**Why it happens:** The session-expired banner (Phase 3) and stale-data banner (Phase 4) use the same fixed-position pattern.
**How to avoid:** Use different CSS classes. The stale-data banner should be at `top: 48px` (below the header's network badge) or use `position: relative` inside the dashboard container, not `position: fixed`. Alternatively, stack them: session-expired z-index 500, stale-data z-index 450.

### Pitfall 4: `appStateChange` Executed Before Biometric Check
**What goes wrong:** The current Phase 3 `main.js` shows the PIN gate on EVERY resume (line 205: `showPinGate()`). Adding biometric check means we must NOT show the PIN gate if biometric succeeds.
**Why it happens:** The resume handler unconditionally calls `showPinGate()`.
**How to avoid:** Modify the `appStateChange` listener to attempt biometric first (if enabled), and only show the PIN gate as fallback. The biometric check runs BEFORE showing the PIN gate overlay:

```javascript
App.addListener('appStateChange', async ({ isActive }) => {
  if (isActive) {
    const biometricResult = await tryBiometricAuth();
    if (!biometricResult.ok) {
      showPinGate(); // Only show PIN if biometric fails
    }
  }
});
```

### Pitfall 5: `cachedTimestamp` Not Updated When Offline
**What goes wrong:** D-44 says "on success write to cache, on failure read from cache" but D-46 says "cache refreshed on every successful call." If the device is offline for hours, the timestamp still reflects the last successful fetch — correct behavior, but the stale-data banner might show "last updated 3 hours ago" which is intentional.
**How to avoid:** Don't update the timestamp from cached data. The timestamp is only updated on successful API calls. This is correct by design.

### Pitfall 6: Debounce Timer Leak on Component Unmount
**What goes wrong:** If a `setTimeout` is pending when the dashboard is hidden/replaced (e.g., by bottom navigation in Phase 5), the callback fires on a stale DOM.
**How to avoid:** Clear the debounce timer whenever the dashboard is hidden or destroyed. Store the timer ID and call `clearTimeout()` on cleanup.

## Code Examples

### Example 1: Formatters (ported from renderer.js)

```javascript
// Source: Ported from src/renderer.js:22-37 [VERIFIED: codebase grepped]
const currency = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

const keyFor = (value) => String(value || '').trim().toLowerCase();
const formatQty = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '0.00';
};
const formatRate = (value) => currency.format(Number(value || 0)).replace('PKR', 'Rs');
```

### Example 2: Stock Table Render (with search filter)

```javascript
// Source: Ported from src/renderer.js:515-536 [VERIFIED: codebase grepped]
function renderStockTable(balances, searchTerm) {
  const filtered = searchTerm
    ? balances.filter((item) =>
        keyFor(`${item.item} ${item.category}`).includes(keyFor(searchTerm))
      )
    : balances;

  const tbody = document.getElementById('stock-table-body');

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td class="empty-row" colspan="7">No stock balance found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (item) => `
        <tr>
          <td><strong>${escapeHtml(item.item)}</strong></td>
          <td>${escapeHtml(item.category)}</td>
          <td>${formatQty(item.inQty)}</td>
          <td>${formatQty(item.outQty)}</td>
          <td><strong>${formatQty(item.balance)}</strong></td>
          <td>${formatRate(item.latestRate)}</td>
          <td>${formatRate(item.value)}</td>
        </tr>`
    )
    .join('');
}

// 300ms debounce utility
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const handleSearch = debounce((searchTerm) => {
  renderStockTable(_balances, searchTerm);
}, 300);
```

### Example 3: Stale-Data Banner (D-45)

```javascript
// Source: Same pattern as session-expired-banner from Phase 3 [VERIFIED: codebase grepped]
function showStaleDataBanner(timestamp) {
  const banner = document.getElementById('stale-data-banner');
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString()
    : 'unknown';
  banner.textContent = `Stale data — last updated ${formattedTime}`;
  banner.classList.remove('hidden');

  // Auto-hide after 5 seconds (matching session-expired-banner pattern)
  setTimeout(() => banner.classList.add('hidden'), 5000);
}
```

### Example 4: HTML Dashboard Markup

```html
<!-- For mobile/index.html — replaces current health check <main> content -->
<div id="dashboard-view" class="hidden">
  <!-- Stale-data banner (fixed top, matching session-expired pattern) -->
  <div id="stale-data-banner" class="stale-data-banner hidden">Stale data — last updated ...</div>

  <!-- Metric Cards: 2x2 grid -->
  <div class="metric-grid">
    <div class="metric-card">
      <span class="metric-label">Total Items</span>
      <span class="metric-value" id="metric-total-items">0</span>
      <span class="metric-icon">📦</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Balance Qty</span>
      <span class="metric-value" id="metric-balance-qty">0</span>
      <span class="metric-icon">⚖️</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Stock Value</span>
      <span class="metric-value" id="metric-stock-value">Rs 0</span>
      <span class="metric-icon">💰</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Today's Movement</span>
      <span class="metric-value" id="metric-today-movement">0</span>
      <span class="metric-icon">📊</span>
    </div>
  </div>

  <!-- Search input -->
  <div class="search-container">
    <input type="text" id="dashboard-search" class="search-input"
           placeholder="Search items..." aria-label="Search stock items" />
  </div>

  <!-- Stock table (scrollable) -->
  <div class="stock-table-wrapper" role="region" aria-label="Stock balance table">
    <table class="stock-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Category</th>
          <th>In</th>
          <th>Out</th>
          <th>Balance</th>
          <th>Rate</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody id="stock-table-body">
        <tr><td class="empty-row" colspan="7">No stock balance found</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

### Example 5: Dashboard CSS Styles

```css
/* For mobile/src/style.css — dashboard-specific styles */

/* Container */
#dashboard {
  display: none; /* shown via JS after auth */
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  overflow-y: auto;
  flex: 1;
}
#dashboard.active {
  display: flex;
}

/* Metric grid: 2x2 */
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metric-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  min-height: 80px;
}

.metric-label {
  font-size: 0.75rem;
  color: rgba(224, 224, 224, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 1.25rem;
  opacity: 0.5;
}

/* Search */
.search-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-primary);
  padding: 8px 0;
}

.search-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid rgba(224, 224, 224, 0.15);
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
  -webkit-appearance: none;
}

.search-input:focus {
  border-color: rgba(224, 224, 224, 0.4);
}

/* Stock table */
.stock-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.stock-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  min-width: 600px;
}

.stock-table th {
  text-align: left;
  padding: 10px 8px;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(224, 224, 224, 0.5);
  border-bottom: 1px solid rgba(224, 224, 224, 0.1);
  white-space: nowrap;
}

.stock-table td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(224, 224, 224, 0.05);
  min-height: 44px; /* touch target */
}

.stock-table tbody tr:active {
  background: rgba(224, 224, 224, 0.05);
}

.empty-row {
  text-align: center;
  color: rgba(224, 224, 224, 0.4);
  padding: 32px 8px !important;
}

/* Stale-data banner (placed below header, not fixed) */
.stale-data-banner {
  background: #ff9800;
  color: #fff;
  text-align: center;
  padding: 10px;
  font-size: 0.75rem;
  border-radius: 8px;
  margin-bottom: 8px;
}

.stale-data-banner.hidden {
  display: none;
}
```

### Example 6: Biometric Resume Integration in main.js

```javascript
// Source: Modified from existing main.js appStateChange handler [CITED: CONTEXT.md D-51]
import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { Preferences } from '@capacitor/preferences';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

async function tryBiometricAuth() {
  const { value: enabled } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
  if (!enabled) return { ok: false };

  const biometryInfo = await BiometricAuth.checkBiometry();
  if (!biometryInfo.isAvailable) return { ok: false };

  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Stock Management',
      cancelTitle: 'Use PIN',
      allowDeviceCredential: true,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false };
  }
}

// In init(), replace the appStateChange handler:
App.addListener('appStateChange', async ({ isActive }) => {
  if (isActive) {
    // First, enable biometric check on first auth success
    // Biometric is only enabled if user has used it successfully
    const bioResult = await tryBiometricAuth();
    if (bioResult.ok) {
      // Biometric succeeded — skip PIN gate
      await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'true' });
      return;
    }
    // Fall back to PIN
    const timeout = await checkSessionTimeout();
    if (timeout.expired) {
      showSessionExpired('Session expired');
    }
    showPinGate();
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Electron desktop: entries stored in local JSON files | Capacitor: entries cached in @capacitor/preferences on server response | Phase 4 | No IPC bridge needed; automatic serialization via JSON |
| Electron desktop: getBalances() called on page render | Capacitor: getBalances() called after fetch or cache load | Phase 4 | Pure JS function — identical logic, just called at different lifecycle points |
| Phase 3: PIN-only on app resume | Phase 4: Biometric-first with PIN fallback on resume | Phase 4 | Better UX on resume — fingerprint/face is faster than re-entering PIN |
| Health check UI after auth | Dashboard UI immediately after auth | Phase 4 | D-39: health check is bootstrap only; once authenticated, data is all that matters |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@aparajita/capacitor-biometric-auth` v10.0.0 works correctly with Capacitor 8.4.1 (the installed version) | Standard Stack | Plugin peer deps require `@capacitor/core >=8.0.0` — satisfied. `npx cap sync` may fail if Android native code doesn't compile. Test on emulator ASAP. |
| A2 | `getEntries()` already returns `{ entries: [...] }` from API | Architecture Patterns | Verified via server.js:431-455 — endpoint returns `{ entries: result.rows }`. The `apiRequest` wrapper returns `result.data` which will be `{ entries: [...] }`. Confirmed. |
| A3 | `formatRate()` using `Intl.NumberFormat("en-PK")` works correctly in Android WebView | Code Examples | Android WebView implements `Intl` fully since Chrome-based WebView (Android 7+). Risk is low. Production Electron app already uses it. |
| A4 | The stale-data banner automatically hidden after 5 seconds is the right pattern | Architecture Patterns | If data is stale for the entire app session, the banner hides after 5s per session-expired pattern. User can see data is stale from the offline badge. Acceptable tradeoff. |
| A5 | The `escapeHtml()` function is available or needs to be created | Code Examples | The renderer.js uses `escapeHtml()` (defined earlier in the file). A simple implementation replaces `<`, `>`, `&`, `"` characters. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build toolchain | ✓ | 24.16.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| @aparajita/capacitor-biometric-auth | Biometric unlock | ✗ | 10.0.0 | Must be installed (`npm install; npx cap sync`) |
| @capacitor/preferences | Offline cache | ✓ | 8.0.1 | Already installed |
| @capacitor/app | App lifecycle | ✓ | 8.1.0 | Already installed |
| @capacitor/network | Connectivity check | ✓ | 8.0.1 | Already installed |
| bcryptjs | Offline PIN hash | ✓ | 3.0.3 | Already installed (Phase 3) |

**Missing dependencies with no fallback:**
- `@aparajita/capacitor-biometric-auth` — must be installed and synced. Unique biometric plugin for Capacitor 8.

**Missing dependencies with fallback:**
- None — all other required packages are already installed.

## Validation Architecture

> Note: Nyquist validation is enabled in config.json (`workflow.nyquist_validation: true`). The mobile/ project has no JavaScript test framework installed — no test config files or test scripts exist.

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
| DASH-01 | 4 metric cards render with correct values | manual-only | N/A | ❌ Wave 0 |
| DASH-02 | PKR formatting with Rs and commas | manual-only | N/A | ❌ Wave 0 |
| DASH-03 | Dashboard loads data on open | manual-only | N/A | ❌ Wave 0 |
| DASH-04 | Stock table scrollable with 7 columns | manual-only | N/A | ❌ Wave 0 |
| DASH-05 | Search filters by name/category in real-time | manual-only | N/A | ❌ Wave 0 |
| DASH-06 | Empty state when no data | manual-only | N/A | ❌ Wave 0 |
| CONN-03 | Offline cache + stale-data banner shows correctly | manual-only | N/A | ❌ Wave 0 |
| UI-02 | Touch targets 44px+, single-column layout | manual-only | N/A | ❌ Wave 0 |
| UX-04 | Biometric unlock on app resume | manual-only | N/A | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** N/A (no test suite)
- **Per wave merge:** N/A (no test suite)
- **Phase gate:** Manual verification against success criteria; `/gsd-verify-work` UAT

### Wave 0 Gaps
- [ ] `getBalances()` port — verify against Electron's output with sample data
- [ ] No JavaScript test framework installed — recommendation: add to backlog or Phase 6

## Security Domain

> `security_enforcement` is enabled (absent from config = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | PIN via `/api/pin/verify` (Phase 3); biometric via `@aparajita/capacitor-biometric-auth` (Phase 4) |
| V3 Session Management | yes | Preferences stores `accessPin` for API auth; `biometricEnabled` flag for resume flow |
| V4 Access Control | yes | `getAuthHeaders()` injects `x-access-pin` on all API calls; biometric is just a convenience unlock — does NOT bypass API auth |
| V5 Input Validation | yes | Search input is filtered client-side; no server write path |
| V6 Cryptography | no | No new encryption in this phase; biometric uses platform-native Keychain/Keystore |

### Known Threat Patterns for Capacitor/JS Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Biometric bypass via lack of enrollment | Spoofing | `checkBiometry().isAvailable` confirms enrollment before `authenticate()` call (D-50/D-51) |
| Stale data displayed as fresh | Repudiation | Stale-data banner (D-45) + timestamp shown explicitly; network badge shows offline status |
| Biometric auth skipped on cold start | Spoofing | Biometric only applies on resume (D-51). Cold start always goes through PIN gate (D-27). |
| Device credential interception | Tampering | `allowDeviceCredential: true` delegates to Android system dialog — OS-level security |
| Offline cached entries viewed on another device | Information Disclosure | Biometric/PIN gate protects app access. Cache is in Android SharedPreferences (app-specific sandbox). |

### Biometric-Specific Security Notes

- **Biometric is a convenience, NOT a separate auth path.** The `biometricEnabled` flag in Preferences bypasses the PIN gate on resume, but the session PIN remains in `accessPin` for all API calls. If the user clears app data, biometric enrollment resets.
- **`allowDeviceCredential: true`** is recommended (D-51 says "fall back to PIN if unavailable/fails/cancelled") — the `authenticate()` `cancelTitle: 'Use PIN'` gives the user an explicit way to choose PIN over biometric.

## Sources

### Primary (HIGH confidence)
- `mobile/src/renderer.js:424-453` — `getBalances()` function — balance computation algorithm [VERIFIED: codebase grepped]
- `mobile/src/renderer.js:489-536` — `renderMetrics()` and `renderBalanceRows()` — metric cards and table rendering patterns [VERIFIED: codebase grepped]
- `mobile/src/server.js:431-455` — GET /api/entries response shape `{ entries: [...] }` [VERIFIED: codebase grepped]
- `mobile/src/api.js:66-68` — `getEntries()` convenience function with `auth: true` [VERIFIED: codebase grepped]
- `mobile/src/auth.js` — Phase 3 auth module (subscriber pattern, offline verify, Preferences storage) [VERIFIED: codebase grepped]
- `mobile/src/main.js` — App bootstrap, PIN gate, appStateChange handler [VERIFIED: codebase grepped]
- `mobile/src/connectivity.js` — `isConnected()` and subscriber pattern [VERIFIED: codebase grepped]
- `mobile/src/style.css` — Theme vars, retry bar, session-expired banner patterns [VERIFIED: codebase grepped]
- `mobile/src/package.json` — Existing dependencies [VERIFIED: codebase grepped]
- `@aparajita/capacitor-biometric-auth` npm registry — v10.0.0, Capacitor 8+, peer dep verified [VERIFIED: npm registry]
- `@aparajita/capacitor-biometric-auth` GitHub README — `checkBiometry()`, `authenticate()`, `addResumeListener()` API signatures [CITED: github.com/aparajita/capacitor-biometric-auth]

### Secondary (MEDIUM confidence)
- Phase 3 CONTEXT.md — D-29 (app resume → PIN gate), D-26 (Preferences storage) [CITED: 03-CONTEXT.md]
- Phase 2 CONTEXT.md — D-14 (apiRequest), D-19 (connectivity module), D-23 (retry bar) [CITED: 02-CONTEXT.md]
- Phase 4 CONTEXT.md — D-39 through D-52, specific decisions [CITED: 04-CONTEXT.md]

### Tertiary (LOW confidence)
- N/A — all factual claims verified against codebase, npm registry, or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm; @aparajita/capacitor-biometric-auth v10.0.0 confirmed compatible with Capacitor 8
- Architecture: HIGH — patterns derived from existing codebase (subscriber pattern from connectivity.js, session-expired banner from Phase 3, balance calc from renderer.js)
- Pitfalls: HIGH — verified against actual codebase (package name doesn't exist, appStateChange interaction, formatRate vs formatQty)
- Security: MEDIUM — biometric enrollment flag is stored in Preferences (plain text boolean); acceptable since it's just a UI hint, not a credential

**Research date:** 2026-07-09
**Valid until:** 2026-08-09 (30 days — stable Capacitor ecosystem)