# Phase 5: Quick Rate Check & Navigation Shell — Research

**Researched:** 2026-07-09
**Domain:** Bottom navigation bar, autocomplete input, settings screen, sign-out flow, multi-view app shell
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-53:** Bottom navigation bar with 3 fixed tabs — Dashboard, Rate Check, Settings. Uses view sections pattern: each tab maps to a `<div>` in `index.html` (`#dashboard-view`, `#ratecheck-view`, `#settings-view`) with show/hide toggling, matching the existing Phase 4 pattern.
- **D-54:** Header text updates per active tab. Bottom nav bar is always visible after authentication (below the header, above the content area). Active tab visually highlighted.
- **D-55:** Rate check input filters the local `_balances` array client-side (same data already loaded by dashboard via `/api/entries`). Uses same 300ms debounce pattern from D-47 (Phase 4). User types → dropdown list of matching items → tap to select → shows latest rate and current balance for that item. No separate API call needed.
- **D-56:** Settings displays: company name (from session stored in Preferences), live server health status (calls `/api/health` via existing `getHealth()`), app version (to be determined — agent discretion), and sign-out button. Follows the retry/error patterns from Phase 2 for health check.
- **D-57:** Sign-out clears `accessPin` from Preferences (forces PIN re-entry on next app start). Does NOT clear `pinHash` (enables offline PIN verification if re-entered) or `cachedEntries` (preserves offline data). No confirmation dialog — sign-out happens immediately. App returns to PIN gate after clearing.
- **D-58:** Also clears `biometricEnabled` flag so biometric unlock doesn't attempt on next resume after sign-out.

### The Agent's Discretion
- Exact design and styling of the bottom navigation bar (color, height, active indicator style) — follows existing dark theme variables from `style.css`
- Rate check autocomplete dropdown style (positioning, max-height, scroll)
- Settings layout (list-style items or cards)
- App version source (Capacitor plugin, hardcoded build constant, or `navigator.userAgent`)
- Rate check display format (same `formatRate()`/`formatQty()` from dashboard.js)
- Whether to show "No item selected" state vs empty state on rate check
- Header text content per tab (e.g., "Dashboard", "Rate Check", "Settings")

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-07 | Rate check screen with item name input field | Filter `_balances` array client-side with 300ms debounce. Input field with dropdown overlay. Reuses `formatRate()`/`formatQty()` from dashboard.js. [VERIFIED: codebase grepped — balances.js exports `getBalances`, dashboard.js exports `formatRate`/`formatQty` as internal functions] |
| DASH-08 | Autocomplete suggestions while typing item name | `keyFor().includes()` case-insensitive filter on `_balances[].item`. Dropdown positioned below input with max-height scroll. Tap-to-select updates display. [VERIFIED: codebase grepped — D-47 debounce pattern in dashboard.js:142-150] |
| DASH-09 | Displays latest rate and current balance for selected item | Selected item's `latestRate` + `balance` displayed in styled result area. Uses `formatRate(item.latestRate)` for PKR and `formatQty(item.balance)` for quantity. [VERIFIED: codebase grepped — getBalances() in balances.js produces these fields] |
| UI-01 | Bottom navigation bar with Dashboard, Rate Check, and Settings tabs | Fixed bottom bar with 3 tab buttons. Each tab toggles visibility of view sections via show/hide pattern matching D-39. Active tab highlighted with `.nav-tab.active` state. [VERIFIED: codebase grepped — Phase 4 dashboard.js:120-140 show/hide pattern] |
| UI-03 | App displays app version and build info in Settings | Hardcoded `APP_VERSION` constant or Vite `import.meta.env` define. Displayed as a settings list item. No new Capacitor plugin needed. [ASSUMED] |
| UI-04 | Sign-out option in Settings (clears session) | Button triggers `signOut()` in auth.js. Clears `accessPin` + `biometricEnabled`. Keeps `pinHash` + `cachedEntries`. Calls `_notify({ isAuthenticated: false })` which triggers `onAuthChange` subscriber in main.js → `showPinGate()`. [VERIFIED: codebase grepped — auth.js:86-93 `clearSession()` must be modified or split] |
</phase_requirements>

## Summary

Phase 5 completes the mobile app's navigation shell and adds two new screens: the Quick Rate Check and Settings. The primary architectural change is adding a fixed bottom navigation bar with 3 tabs (Dashboard, Rate Check, Settings) that replaces the current single-view pattern. Each tab maps to a view section div in `index.html` using the same show/hide pattern established in Phase 4 (D-39).

The Rate Check screen provides autocomplete-driven item lookup by filtering the existing `_balances` array (already populated by Dashboard's `loadDashboard()` call). It uses the same 300ms debounce pattern from D-47. No additional API calls are needed — all data is already client-side.

The Settings screen displays company name (from auth session), live server health status (reusing `getHealth()` from Phase 2), app version, and a sign-out button. Sign-out must clear `accessPin` and `biometricEnabled` from Preferences while preserving `pinHash` (for offline PIN re-entry) and `cachedEntries` (for offline data). The existing `clearSession()` in auth.js currently clears `pinHash` — a separate `signOut()` function is needed to comply with D-57.

**Primary recommendation:** Create `mobile/src/ratecheck.js` (autocomplete + display logic) and `mobile/src/settings.js` (settings screen), modify `mobile/src/auth.js` (add `signOut()` keeping `pinHash`), update `mobile/src/main.js` (tab switching, header updates), update `mobile/index.html` (add view sections + bottom nav), and add CSS for all new components.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bottom navigation bar | Browser / Client | — | Fixed bottom bar with 3 tab buttons; show/hide view sections via classList toggle — all client-side DOM |
| Rate check autocomplete | Browser / Client | — | Client-side filter of already-loaded `_balances` array; no server round-trip per D-55 |
| Rate check result display | Browser / Client | — | DOM textContent updates for selected item's latestRate and balance |
| Settings — company name | Browser / Client | — | Read from `getCompanyName()` in auth.js (already stored in Preferences) |
| Settings — server health | Browser / Client | API / Backend | Calls `getHealth()` via server `/api/health` endpoint; display in client-side list item |
| Settings — app version | Browser / Client | — | Build-time constant or hardcoded string displayed in settings list |
| Settings — sign-out | Browser / Client | — | `Preferences.remove()` for `accessPin` + `biometricEnabled`; `_notify()` to trigger PIN gate — all client-side |
| Dashboard (existing) | Browser / Client | — | Existing Phase 4 functionality; still owned by dashboard.js, just accessed via tab now |

## Standard Stack

### Core

No new npm packages required for Phase 5. All functionality uses existing dependencies.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@capacitor/preferences` | ^8.0.1 | Store/clear accessPin, biometricEnabled on sign-out | Already installed (Phase 1). `Preferences.remove()` for sign-out [VERIFIED: npm registry] |
| `@capacitor/app` | ^8.1.0 | App lifecycle for tab state | Already installed (Phase 1) [VERIFIED: npm registry] |
| `@capacitor/network` | ^8.0.1 | Offline detection for health check in Settings | Already installed (Phase 2). `isConnected()` for online/offline branch [VERIFIED: npm registry] |

### Supporting — No Supporting Dependencies Needed

All Phase 5 screens use existing data and functions:
- `getBalances()` from balances.js — already provides `_balances` array structure
- `getEntries()` from api.js — already called by dashboard, populates data
- `getHealth()` from api.js — already provides health check
- `getCompanyName()` from auth.js — already returns session company name
- `formatRate()` / `formatQty()` from dashboard.js — already format PKR and quantities
- `isConnected()` from connectivity.js — already detects network state

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-level getter for `_balances` (export from dashboard.js) | Separate state store (custom event bus) | Getter is simpler (3 lines), matches existing pattern (`isConnected()`, `getNetworkStatus()`). Event bus is over-engineering for 2 consumers. |
| Build-time version constant in Vite config | `@capacitor/device` plugin for native app version | Vite config avoids adding a dependency. `@capacitor/device` is more accurate but unnecessary for a hardcoded version display. |
| New `signOut()` in auth.js separate from `clearSession()` | Modify `clearSession()` with a parameter | Separate function avoids breaking `handleSessionExpiry()` which needs to clear `pinHash`. Cleaner separation of concerns. |

**Installation:** None required. No new packages to install.

## Package Legitimacy Audit

No new packages are installed in Phase 5. All functionality uses the existing dependency set:

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| `@capacitor/preferences` ^8.0.1 | npm | [OK] | Already installed (Phase 1) |
| `@capacitor/app` ^8.1.0 | npm | [OK] | Already installed (Phase 1) |
| `@capacitor/network` ^8.0.1 | npm | [OK] | Already installed (Phase 2) |
| `bcryptjs` ^3.0.3 | npm | [OK] | Already installed (Phase 3) |
| `@aparajita/capacitor-biometric-auth` ^10.0.0 | npm | [OK] | Already installed (Phase 4) |

**Packages removed due to SLOP verdict:** None
**Packages flagged as suspicious:** None

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Capacitor WebView                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Header ("Zestok" + "[Tab Name]" + net badge)        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │Dashboard │  │  Rate Check  │  │  Settings    │     │   │
│  │  │  View    │  │    View      │  │    View      │     │   │
│  │  │          │  │              │  │              │     │   │
│  │  │ metrics  │  │ input field  │  │ company name │     │   │
│  │  │ stock    │  │ dropdown     │  │ health stat  │     │   │
│  │  │ table    │  │ rate/balance │  │ app version  │     │   │
│  │  │ search   │  │ display      │  │ sign-out btn │     │   │
│  │  └──────────┘  └──────────────┘  └──────────────┘     │   │
│  │                                                         │   │
│  │   ┌─── tab switch: showDashboard/hideDashboard,         │   │
│  │   │  showRateCheck/showSettings via classList            │   │
│  └───┴─────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Bottom Navigation Bar                       │   │
│  │  [📊 Dashboard] [🔍 Rate Check] [⚙️ Settings] ← active│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────┐  ┌──────────────────────────┐  │
│  │  Retry Bar (fixed bottom,  │  │ Session-expired banner   │  │
│  │  z-index 100, above nav)   │  │ (fixed top, z-index 500)│  │
│  └────────────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          │  getHealth() / getEntries() via apiRequest
          ▼
┌──────────────────────────────┐
│     Express API Server       │
│  /api/health, /api/entries   │
└──────────────────────────────┘
```

**Tab Switch Flow:**
1. User taps bottom nav tab → event handler calls `switchTab(tabName)`
2. `switchTab()` hides all views (`#dashboard-view`, `#ratecheck-view`, `#settings-view`)
3. Shows the selected view by removing `.hidden` class
4. Updates header text to match active tab (e.g., "Rate Check" header when on rate check tab)
5. Updates active tab highlight (adds `.active` to clicked tab, removes from others)
6. If Dashboard tab and not yet loaded → `showDashboard()` calls `loadDashboard()`
7. If Rate Check tab → `showRateCheck()` renders UI with existing `_balances` data
8. If Settings tab → `showSettings()` fetches health status

### Recommended Project Structure
```
mobile/src/
├── api.js              # Existing: getHealth(), getEntries()
├── auth.js             # EXISTING (MODIFIED): add signOut() — separate from clearSession()
├── balances.js         # Existing: getBalances(), keyFor() — rate check imports keyFor()
├── connectivity.js     # Existing: isConnected()
├── dashboard.js        # EXISTING (MODIFIED): export formatRate, formatQty, getBalancesState()
├── main.js             # EXISTING (MODIFIED): tab switching, header update, auth false→pin gate
├── ratecheck.js        # NEW: Autocomplete + rate/balance display for selected item
├── settings.js         # NEW: Settings screen with health check, company name, sign-out
├── style.css           # EXISTING (MODIFIED): nav bar, ratecheck, settings, layout adjustments
├── index.html          # EXISTING (MODIFIED): add view sections + bottom nav markup
```

### Pattern 1: View Show/Hide (Replicating Phase 4 Pattern)

**What:** Each tab corresponds to a `<div>` view section that is shown/hidden via classList toggle of the `.hidden` class. Exactly matching the existing `showDashboard()`/`hideDashboard()` pattern from dashboard.js:120-140.

**When to use:** For all 3 tab views — Dashboard, Rate Check, Settings.

```javascript
// Source: Replicating dashboard.js:120-140 pattern [VERIFIED: codebase grepped]

// Tab switching handler (in main.js)
const _tabs = new Map(); // tab name → { show: fn, hide: fn }

function registerTab(name, showFn, hideFn) {
  _tabs.set(name, { show: showFn, hide: hideFn });
}

function switchTab(tabName) {
  // Hide all views
  for (const [, tab] of _tabs) tab.hide();
  
  // Update header
  const headerMap = {
    dashboard: 'Dashboard',
    ratecheck: 'Rate Check',
    settings: 'Settings',
  };
  document.querySelector('header').innerHTML = `
    Zestok
    <span id="network-badge" class="network-online">Online</span>
    <span class="header-tab">${headerMap[tabName] || ''}</span>
  `;
  
  // Update nav active state
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Show selected view
  const tab = _tabs.get(tabName);
  if (tab) tab.show();
}
```

### Pattern 2: Rate Check Autocomplete (Client-Side Filter + Dropdown)

**What:** User types → 300ms debounce → filter `_balances` by `keyFor(item.item).includes(keyFor(input))` → render dropdown list below input → tap to select → show rate + balance.

**When to use:** Only on the rate check screen.

```javascript
// Source: D-55, D-47, D-08; pattern from dashboard.js:142-150 debounce [VERIFIED: codebase grepped]
import { keyFor } from './balances.js';

let _balances = []; // populated via getBalancesState() export from dashboard.js
let _selectedItem = null;
let _debounceTimer = null;

export function showRateCheck(balancesData) {
  _balances = balancesData || [];
  document.getElementById('ratecheck-view').classList.remove('hidden');
  // Show empty state if no data
  if (_balances.length === 0) {
    document.getElementById('ratecheck-result').classList.add('hidden');
    document.getElementById('ratecheck-empty').classList.remove('hidden');
  }
}

export function hideRateCheck() {
  document.getElementById('ratecheck-view').classList.add('hidden');
  clearTimeout(_debounceTimer);
}

function initRateCheckInput() {
  const input = document.getElementById('ratecheck-input');
  const dropdown = document.getElementById('ratecheck-dropdown');
  const result = document.getElementById('ratecheck-result');
  
  input.addEventListener('input', (e) => {
    clearTimeout(_debounceTimer);
    const term = e.target.value.trim();
    
    if (!term) {
      dropdown.classList.add('hidden');
      result.classList.add('hidden');
      _selectedItem = null;
      return;
    }
    
    _debounceTimer = setTimeout(() => {
      const matches = _balances.filter((item) =>
        keyFor(item.item).includes(keyFor(term))
      );
      renderDropdown(dropdown, matches, input, result);
    }, 300);
  });
  
  // Close dropdown on tap outside
  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('#ratecheck-input') && !e.target.closest('#ratecheck-dropdown')) {
      dropdown.classList.add('hidden');
    }
  });
}

function renderDropdown(dropdown, matches, input, result) {
  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="ratecheck-dropdown-item ratecheck-no-match">No items found</div>';
    dropdown.classList.remove('hidden');
    return;
  }
  
  dropdown.innerHTML = matches
    .map((item) => `<div class="ratecheck-dropdown-item" data-item="${escapeHtml(item.item)}">
      <strong>${escapeHtml(item.item)}</strong>
      <span class="ratecheck-dropdown-category">${escapeHtml(item.category)}</span>
    </div>`)
    .join('');
  dropdown.classList.remove('hidden');
  
  // Tap to select
  dropdown.querySelectorAll('.ratecheck-dropdown-item').forEach((el) => {
    el.addEventListener('click', () => {
      const selected = matches.find((m) => m.item === el.dataset.item);
      if (selected) {
        selectItem(selected, input, dropdown, result);
      }
    });
  });
}

function selectItem(item, input, dropdown, result) {
  _selectedItem = item;
  input.value = item.item;
  dropdown.classList.add('hidden');
  
  // Display rate and balance
  document.getElementById('ratecheck-rate-value').textContent = formatRate(item.latestRate);
  document.getElementById('ratecheck-balance-value').textContent = formatQty(item.balance);
  document.getElementById('ratecheck-item-name').textContent = item.item;
  document.getElementById('ratecheck-item-category').textContent = item.category;
  result.classList.remove('hidden');
}
```

### Pattern 3: Settings Screen

**What:** List-style layout showing company name, server health, app version, sign-out button. Health check uses existing `getHealth()` with retry/error patterns from Phase 2.

**When to use:** On the Settings tab.

```javascript
// Source: D-56, D-57, D-58; getHealth() from api.js [VERIFIED: codebase grepped]
import { getHealth } from './api.js';
import { getCompanyName, isAuthenticated } from './auth.js';
import { isConnected } from './connectivity.js';

const APP_VERSION = '1.0.0';

export async function showSettings() {
  document.getElementById('settings-view').classList.remove('hidden');
  
  // Company name
  document.getElementById('settings-company').textContent = getCompanyName() || '—';
  
  // App version
  document.getElementById('settings-version').textContent = APP_VERSION;
  
  // Server health — fetch live
  await updateHealthStatus();
}

export function hideSettings() {
  document.getElementById('settings-view').classList.add('hidden');
}

async function updateHealthStatus() {
  const statusEl = document.getElementById('settings-health-value');
  const spinnerEl = document.getElementById('settings-health-spinner');
  
  spinnerEl.classList.remove('hidden');
  statusEl.textContent = 'Checking...';
  statusEl.className = '';
  
  if (!isConnected()) {
    spinnerEl.classList.add('hidden');
    statusEl.textContent = 'Offline';
    statusEl.className = 'settings-health-offline';
    return;
  }
  
  const result = await getHealth();
  spinnerEl.classList.add('hidden');
  
  if (result.ok) {
    statusEl.textContent = 'Connected';
    statusEl.className = 'settings-health-ok';
  } else {
    statusEl.textContent = 'Unreachable';
    statusEl.className = 'settings-health-error';
  }
}
```

### Pattern 4: Sign-Out Flow (D-57, D-58)

**What:** Sign-out button in Settings triggers `signOut()` in auth.js that clears `accessPin` + `biometricEnabled`, keeps `pinHash` + `cachedEntries`, then notifies main.js → shows PIN gate.

**When to use:** Sign-out button click and session expiry (separate `clearSession()` for the latter, per D-31).

```javascript
// Source: D-57, D-58; modified from auth.js:86-93 clearSession() [VERIFIED: codebase grepped]
// In auth.js — new function, NOT modifying clearSession()
const _subscribers = new Set();

export async function signOut() {
  // Clear — forces PIN re-entry (D-57)
  await Preferences.remove({ key: 'accessPin' });
  // Clear biometric flag (D-58)
  await Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
  // Does NOT clear pinHash (D-57 — allows offline PIN re-entry)
  // Does NOT clear cachedEntries (D-57 — preserves offline data)
  // Does NOT clear companyName — optional (could keep for display)
  // Does NOT clear tenantId — optional
  
  _notify({ isAuthenticated: false, companyName: '', tenantId: '' });
}

// The existing clearSession() remains unchanged for session expiry:
export async function clearSession() {
  await Preferences.remove({ key: 'accessPin' });
  await Preferences.remove({ key: 'companyName' });
  await Preferences.remove({ key: 'tenantId' });
  await Preferences.remove({ key: 'pinHash' });
  await Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
  _notify({ isAuthenticated: false, companyName: '', tenantId: '' });
}
```

### Anti-Patterns to Avoid
- **Sharing `_balances` by making it a global variable:** Instead, export a getter from dashboard.js (`getBalancesState()`) following the existing `isConnected()`/`getNetworkStatus()` pattern from connectivity.js.
- **Calling `/api/entries` again for rate check:** D-55 explicitly says no separate API call — the data is already in `_balances`. Rate check just filters client-side.
- **Using `clearSession()` for sign-out:** It clears `pinHash`, violating D-57. Must use a new `signOut()` that preserves `pinHash` and `cachedEntries`.
- **Hardcoding app version in multiple places:** Define it once as a constant (e.g., `const APP_VERSION = '1.0.0'` in settings.js or a config module) and display from there.
- **Position: fixed conflicts:** Bottom nav (`position: fixed; bottom: 0; z-index: 90`) and retry bar (`position: fixed; bottom: 0; z-index: 100`) both sit at the bottom. Retry bar has higher z-index so it visually overlaps the nav when visible — acceptable for an infrequent transient element.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Item filter for autocomplete | Custom fuzzy-find | `keyFor(item.item).includes(keyFor(term))` | Already proven in D-47/D-48 (Phase 4 dashboard search). Case-insensitive, substring match — sufficient for item name lookup. |
| Currency formatting for rate display | Manual comma insertion | `formatRate()` export from dashboard.js | Already proven in Phase 4. `Intl.NumberFormat('en-PK', { currency: 'PKR' })` handles PKR formatting with commas. |
| Quantity formatting | Manual decimal formatting | `formatQty()` export from dashboard.js | Already proven in Phase 4. `toLocaleString('en-PK', { maximumFractionDigits: 2 })` handles comma separators. |
| Debounce | Raw setTimeout/clearTimeout in every keystroke handler | 300ms debounce helper (4-line pattern from D-47) | Already proven in Phase 4 (dashboard.js:142-150). Simple enough not to need Lodash. |
| Sign-out session clear | Manual Preferences.remove in settings.js | `signOut()` in auth.js | Keeps session management centralized. `onAuthChange` subscription handles UI transition automatically. |

## Common Pitfalls

### Pitfall 1: `clearSession()` vs `signOut()` Confusion
**What goes wrong:** Using the existing `clearSession()` for sign-out clears `pinHash`, preventing offline PIN re-entry. D-57 explicitly requires keeping `pinHash`.
**Why it happens:** The Phase 3 `clearSession()` was designed for session expiry, where clearing `pinHash` is correct. Sign-out is a different operation.
**How to avoid:** Create a separate `signOut()` function in auth.js that only clears `accessPin` and `biometricEnabled`. Do not modify `clearSession()`.
**Warning signs:** After sign-out, user can still access the app offline without re-entering PIN (because `pinHash` was kept and auto-auth restored). Or conversely: after sign-out, offline PIN re-entry fails because `pinHash` was cleared.

### Pitfall 2: `_balances` Not Yet Loaded When Switching to Rate Check
**What goes wrong:** User switches to Rate Check tab immediately after auth, before dashboard finishes loading. `_balances` is empty, so no autocomplete results show.
**Why it happens:** Rate check reads from `_balances` which is populated asynchronously by `loadDashboard()`. If the user taps Rate Check before the API call completes, the data isn't there yet.
**How to avoid:** The rate check should show a loading/empty state ("No data — visit Dashboard first"). OR: have the rate check call `loadDashboard()` independently if `_balances` is empty. The simplest approach: Dashboard is the default tab on auth (D-39), so by the time the user navigates, data should be loaded. Show an explicit "Loading..." state as fallback.

### Pitfall 3: Bottom Nav + Retry Bar Z-Index Conflict
**What goes wrong:** Both `#retry-bar` and the bottom nav use `position: fixed; bottom: 0`. If both have the same z-index, they overlap or the wrong one appears on top.
**Why it happens:** The retry bar was designed as the single bottom-fixed element. Adding a bottom nav creates a stacking context conflict.
**How to avoid:** Assign bottom nav `z-index: 90` and retry bar `z-index: 100`. The retry bar sits above the nav when visible (acceptable — it's a transient, infrequent element). Content area has `padding-bottom: calc(64px + env(safe-area-inset-bottom))` to avoid being covered by the bottom nav.

### Pitfall 4: `formatRate`/`formatQty` Not Accessible from ratecheck.js
**What goes wrong:** Rate check tries to import `formatRate` from dashboard.js but they're internal functions (defined with `function`, not exported).
**Why it happens:** Phase 4 wrote them as module-internal helpers. They need to be exported for reuse.
**How to avoid:** Add `export` to `formatRate` and `formatQty` in dashboard.js. Export a `getBalancesState()` getter for the `_balances` array. These are trivial changes that don't affect existing dashboard functionality.

### Pitfall 5: Header InnerHTML Overwrite Destroys Network Badge
**What goes wrong:** D-54 says header text updates per active tab. If the header is rewritten using `innerHTML`, the network badge element is recreated, losing its event listeners or state.
**Why it happens:** `document.querySelector('header').innerHTML = '...'` removes and recreates DOM nodes.
**How to avoid:** Instead of replacing the entire header content, update only the relevant text node. Either:
- Pre-segment the header with spans: `<header><span>Zestok</span> <span id="header-tab-name">Dashboard</span> <span id="network-badge">...</span></header>`
- Or update only the tab name text: `document.getElementById('header-tab-name').textContent = tabLabel;`

### Pitfall 6: Debounce Timer Leak on Tab Switch
**What goes wrong:** User starts typing in rate check, then switches to Settings before the 300ms fires. The timer fires on a hidden view, potentially causing errors.
**Why it happens:** Same issue as Phase 4 Pitfall 6 for dashboard.
**How to avoid:** Clear all debounce timers in each view's `hide*()` function. This is already done in `hideDashboard()` (dashboard.js:131-134). Replicate for `hideRateCheck()`.

## Code Examples

### Example 1: Tab Switching and Header Update

```javascript
// Source: D-53, D-54; matching show/hide pattern from dashboard.js:120-140 [VERIFIED: codebase grepped]
function switchTab(tabName) {
  // Hide all views
  const views = ['dashboard-view', 'ratecheck-view', 'settings-view'];
  views.forEach((id) => document.getElementById(id)?.classList.add('hidden'));
  
  // Show selected view
  const viewMap = {
    dashboard: 'dashboard-view',
    ratecheck: 'ratecheck-view',
    settings: 'settings-view',
  };
  const target = document.getElementById(viewMap[tabName]);
  if (target) target.classList.remove('hidden');
  
  // Update header tab text (preserve network badge — don't overwrite entire header)
  const headerTab = document.getElementById('header-tab-name');
  if (headerTab) {
    const labels = { dashboard: 'Dashboard', ratecheck: 'Rate Check', settings: 'Settings' };
    headerTab.textContent = labels[tabName] || '';
  }
  
  // Update nav active state
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Notify tab
  const callbacks = {
    dashboard: () => { showDashboard(); },
    ratecheck: () => { showRateCheck(getBalancesState()); },
    settings: () => { showSettings(); },
  };
  if (callbacks[tabName]) callbacks[tabName]();
}
```

### Example 2: Export Getters from dashboard.js

```javascript
// Source: Following getter pattern from connectivity.js:6-8 [VERIFIED: codebase grepped]

// Add to dashboard.js:
export function getBalancesState() {
  return _balances;
}

export function formatQty(num) {
  const n = Number(num);
  return Number.isFinite(n) ? n.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '0';
}

export function formatRate(num) {
  const n = Number(num || 0);
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })
    .format(n)
    .replace('PKR', 'Rs');
}
```

### Example 3: Bottom Navigation HTML

```html
<!-- For mobile/index.html — add inside #app, before </div> closing -->
<!-- Bottom navigation bar -->
<nav id="bottom-nav">
  <button class="nav-tab active" data-tab="dashboard">
    <span class="nav-icon">📊</span>
    <span class="nav-label">Dashboard</span>
  </button>
  <button class="nav-tab" data-tab="ratecheck">
    <span class="nav-icon">🔍</span>
    <span class="nav-label">Rate Check</span>
  </button>
  <button class="nav-tab" data-tab="settings">
    <span class="nav-icon">⚙️</span>
    <span class="nav-label">Settings</span>
  </button>
</nav>
```

### Example 4: Rate Check View HTML

```html
<!-- For mobile/index.html — add inside #app, before bottom nav -->
<div id="ratecheck-view" class="hidden">
  <div class="ratecheck-search">
    <input type="text" id="ratecheck-input" class="ratecheck-input"
           placeholder="Type item name..." autocomplete="off"
           aria-label="Search item for rate check" />
    <div id="ratecheck-dropdown" class="ratecheck-dropdown hidden"></div>
  </div>
  
  <div id="ratecheck-empty" class="ratecheck-empty">
    <p>Type an item name above to check its latest rate and balance.</p>
  </div>
  
  <div id="ratecheck-result" class="ratecheck-result hidden">
    <div class="ratecheck-result-header">
      <span id="ratecheck-item-name" class="ratecheck-item-name"></span>
      <span id="ratecheck-item-category" class="ratecheck-item-category"></span>
    </div>
    <div class="ratecheck-result-cards">
      <div class="ratecheck-card">
        <span class="ratecheck-card-label">Latest Rate</span>
        <span id="ratecheck-rate-value" class="ratecheck-card-value ratecheck-rate-value">Rs 0</span>
      </div>
      <div class="ratecheck-card">
        <span class="ratecheck-card-label">Current Balance</span>
        <span id="ratecheck-balance-value" class="ratecheck-card-value">0</span>
      </div>
    </div>
  </div>
</div>
```

### Example 5: Settings View HTML

```html
<!-- For mobile/index.html — add inside #app, before bottom nav -->
<div id="settings-view" class="hidden">
  <div class="settings-list">
    <div class="settings-item">
      <span class="settings-item-label">Company</span>
      <span class="settings-item-value" id="settings-company">—</span>
    </div>
    <div class="settings-item">
      <span class="settings-item-label">Server</span>
      <span class="settings-item-value" id="settings-health-value">
        <span id="settings-health-spinner" class="spinner-sm hidden"></span>
        <span>Checking...</span>
      </span>
    </div>
    <div class="settings-item" id="settings_health_retry" style="display:none">
      <button id="settings-health-retry-btn" class="action-btn">Retry</button>
    </div>
    <div class="settings-item">
      <span class="settings-item-label">App Version</span>
      <span class="settings-item-value" id="settings-version">—</span>
    </div>
  </div>
  
  <button id="signout-btn" class="settings-signout-btn">Sign Out</button>
</div>
```

### Example 6: Bottom Navigation CSS

```css
/* For mobile/src/style.css — nav bar styles */

#bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--bg-secondary);
  border-top: 1px solid rgba(224, 224, 224, 0.1);
  z-index: 90; /* Below retry-bar (100) but above content */
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  background: none;
  border: none;
  color: rgba(224, 224, 224, 0.5);
  font-size: 0.625rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s;
}

.nav-tab.active {
  color: var(--accent-green);
}

.nav-tab:active {
  opacity: 0.7;
}

.nav-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.nav-label {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### Example 7: Settings CSS

```css
/* For mobile/src/style.css — settings screen styles */

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: rgba(224, 224, 224, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--bg-secondary);
  min-height: 48px;
}

.settings-item-label {
  font-size: 0.875rem;
  color: rgba(224, 224, 224, 0.6);
}

.settings-item-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

.settings-signout-btn {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  color: var(--accent-red);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 24px;
  transition: background 0.2s;
}

.settings-signout-btn:active {
  background: rgba(244, 67, 54, 0.2);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single view (dashboard only) | Multi-tab navigation with 3 views | Phase 5 | Dashboard view is hidden/shown via bottom nav instead of always visible after auth |
| Manual view navigation (hide PIN → show dashboard) | Bottom nav tab switching with 3 view sections | Phase 5 | Unified `switchTab()` handler manages show/hide for all views |
| No Settings screen | Settings screen with company name, health, version, sign-out | Phase 5 | New auth.js `signOut()` function; existing `clearSession()` unchanged |
| `clearSession()` clears everything | `signOut()` keeps `pinHash` + `cachedEntries`; `clearSession()` unchanged for expiry | Phase 5 | D-57 distinction between sign-out and session expiry |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `formatRate` and `formatQty` can be exported from dashboard.js without breaking existing code | Code Examples | Low — adding `export` to existing functions is backward-compatible. Callers within dashboard.js remain unchanged. |
| A2 | A getter `getBalancesState()` exported from dashboard.js correctly exposes the latest `_balances` array | Architecture Patterns | Low — the getter returns the module-level `_balances` variable which is always up-to-date after any `setState()` call. |
| A3 | Hardcoded `APP_VERSION = '1.0.0'` in settings.js is sufficient for MVP | Code Examples | Low — version must be manually updated on each release. For production, a Vite `define` with `import.meta.env.VITE_APP_VERSION` would be more maintainable. |
| A4 | The `onAuthChange` subscriber in main.js can be extended to handle `isAuthenticated === false` by showing the PIN gate | Architecture Patterns | Medium — the current subscriber only checks `if (auth)`. Adding an `else { showPinGate(); }` branch is straightforward but `showPinGate()` must be available (it's already defined in main.js scope). Verified. |
| A5 | Bottom nav height of ~64px is sufficient for 3 tab labels | Code Examples | Low — standard mobile bottom nav height is 56-64px. 64px with `padding-bottom: env(safe-area-inset-bottom)` covers most device configurations. |

## Open Questions (RESOLVED)

1. **[App Version Source]**
   - What we know: Agent discretion. Options are hardcoded constant, Vite `import.meta.env` define, or `navigator.userAgent` parsing.
   - What's unclear: Whether the user wants version auto-synced with `package.json` or a manually maintained constant.
   - Recommendation: Start with a hardcoded constant `'1.0.0'` in settings.js. It's the simplest approach. If auto-sync is needed, a Vite define can be added later.

2. **[Rate Check Empty State]**
   - What we know: Agent discretion to decide "No item selected" vs empty state.
   - What's unclear: Should the rate check show a prompt ("Type an item name") or be blank until the user interacts?
   - Recommendation: Show a helpful prompt: "Type an item name above to check its latest rate and balance." — eliminates confusion without adding clutter.

## Validation Architecture

> Nyquist validation config not found — defaulting to enabled (`workflow.nyquist_validation` absent from `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | No test command defined |
| Full suite command | No test command defined |

### Phase Requirements → Test Map

Since no testing infrastructure exists, all verification is manual-only for this phase.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-07 | Rate check input field accepts text and shows results | manual-only | N/A | ❌ Wave 0 |
| DASH-08 | Autocomplete dropdown shows matching items as user types (300ms debounce) | manual-only | N/A | ❌ Wave 0 |
| DASH-09 | Selected item's latest rate (PKR) and current balance (qty) display correctly | manual-only | N/A | ❌ Wave 0 |
| UI-01 | Bottom nav with 3 tabs switches views correctly; active tab highlighted | manual-only | N/A | ❌ Wave 0 |
| UI-03 | Settings shows app version string | manual-only | N/A | ❌ Wave 0 |
| UI-04 | Sign-out clears accessPin, returns to PIN gate | manual-only | N/A | ❌ Wave 0 |

### Verification Suggestions (manual)

- **Autocomplete correctness:** Type partial item names, verify matching items appear in dropdown. Verify non-matching terms show "No items found".
- **Sign-out state:** After sign-out, close and reopen app. Verify PIN is required. Verify offline PIN verification still works (pinHash preserved).
- **Tab switching:** Switch between all 3 tabs. Verify correct view appears and active tab highlight follows.
- **Header text:** Verify header displays tab name when switching tabs. Verify network badge is NOT destroyed.
- **Health check in Settings:** Verify spinner during check, "Connected"/"Unreachable" states, retry on failure.
- **Bottom nav + retry bar:** When retry bar appears (simulate transient error), verify it's visible above the bottom nav. When dismissed, bottom nav is fully visible.

### Sampling Rate

- **Per task commit:** Manual verification — test the specific component changed
- **Per wave merge:** Manual tab switching + sign-out flow
- **Phase gate:** `/gsd-verify-work` UAT against all 5 success criteria

### Wave 0 Gaps

- [ ] No test framework exists — cannot automate verification
- [ ] Rate check with 0 `_balances` items (no data loaded yet) — test manually

## Security Domain

> `security_enforcement` is enabled (absent from config = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Sign-out clears `accessPin` (D-57); `pinHash` preserved for offline PIN re-entry (D-31); PIN gate re-shown after sign-out |
| V3 Session Management | yes | `accessPin` + `biometricEnabled` cleared on sign-out (D-57, D-58); `cachedEntries` preserved for offline data availability |
| V4 Access Control | yes | Sign-out does not bypass server auth — next API call after sign-out will fail (no `accessPin` in `getAuthHeaders()`), triggering re-auth |
| V5 Input Validation | yes | Rate check input is client-side filtered only; no write path; `escapeHtml()` in autocomplete dropdown prevents DOM injection |
| V6 Cryptography | no | No new encryption in this phase |

### Known Threat Patterns for Capacitor/JS Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sign-out doesn't clear legacy server auth | Spoofing | Sign-out-only clears client-side `accessPin`. The server's device trust is separate (Phase 3 server has `trusted_devices` table — untouched). Next API call with empty `x-access-pin` header will 401, triggering PIN re-entry. |
| Offline PIN re-entry bypass after sign-out | Spoofing | `pinHash` preserved (D-57) but `accessPin` cleared (D-57). On next offline launch, user must re-enter PIN which is verified against `pinHash`. Reasonable security — same bcrypt comparison. |
| Stale cached data shown after sign-out | Information Disclosure | `cachedEntries` preserved (D-57) but PIN gate protects access. After sign-out, returning to PIN gate prevents unauthorized viewing of cached data. |
| Biometric bypass after sign-out | Spoofing | `biometricEnabled` cleared (D-58). Next resume after sign-out: PIN gate shows, no biometric attempt. |

## Sources

### Primary (HIGH confidence)
- `mobile/src/dashboard.js:120-140` — View show/hide pattern for tab implementation [VERIFIED: codebase grepped]
- `mobile/src/dashboard.js:142-150` — 300ms debounce utility pattern [VERIFIED: codebase grepped]
- `mobile/src/dashboard.js:152-181` — `renderStockTable()` with `keyFor().includes()` filter pattern [VERIFIED: codebase grepped]
- `mobile/src/dashboard.js:22-27` — `formatRate()` PKR formatting pattern [VERIFIED: codebase grepped]
- `mobile/src/dashboard.js:17-20` — `formatQty()` quantity formatting pattern [VERIFIED: codebase grepped]
- `mobile/src/balances.js:1-34` — `getBalances()` output shape (fields: `item`, `category`, `latestRate`, `balance`) [VERIFIED: codebase grepped]
- `mobile/src/balances.js:1` — `keyFor()` string normalization [VERIFIED: codebase grepped]
- `mobile/src/auth.js:86-93` — `clearSession()` (baseline for `signOut()`) [VERIFIED: codebase grepped]
- `mobile/src/auth.js:7-11` — Subscriber pattern for auth state changes [VERIFIED: codebase grepped]
- `mobile/src/auth.js:17-24` — `isAuthenticated()`, `getCompanyName()` exported getters [VERIFIED: codebase grepped]
- `mobile/src/connectivity.js:6-8` — `isConnected()` getter (health check in Settings) [VERIFIED: codebase grepped]
- `mobile/src/api.js:62-64` — `getHealth()` for Settings server status [VERIFIED: codebase grepped]
- `mobile/src/main.js:46-58` — `showPinGate()`/`hidePinGate()` for sign-out return flow [VERIFIED: codebase grepped]
- `mobile/src/main.js:195-200` — `onAuthChange` subscriber (must add `else { showPinGate() }` for sign-out) [VERIFIED: codebase grepped]
- `mobile/src/main.js:220` — `document.getElementById('dashboard-retry-btn')?.addEventListener` — pattern for wiring sign-out button [VERIFIED: codebase grepped]
- `mobile/index.html` — Current view sections pattern (dashboard-view, pin-gate-overlay) [VERIFIED: codebase grepped]
- `mobile/src/style.css:127-162` — `#retry-bar` fixed-bottom pattern (z-index conflicts with bottom nav) [VERIFIED: codebase grepped]

### Secondary (MEDIUM confidence)
- Phase 4 CONTEXT.md — D-47 (300ms debounce), D-48 (instant clear), D-49 (keyboard dismiss) [CITED: 04-CONTEXT.md]
- Phase 3 CONTEXT.md — D-26 (accessPin in Preferences), D-31 (pinHash for offline), D-32 (bcrypt compare) [CITED: 03-CONTEXT.md]
- Phase 2 CONTEXT.md — D-14 (apiRequest), D-17 (structured response), D-23 (retry bar), D-24 (inline error) [CITED: 02-CONTEXT.md]
- Phase 5 CONTEXT.md — D-53 through D-58 [CITED: 05-CONTEXT.md]
- Electron `src/renderer.js:482-487` — `setTab()` showing classList toggle pattern for tab switching [VERIFIED: codebase grepped]

### Tertiary (LOW confidence)
- A4 (onAuthChange extended for sign-out) — confirmed by reading main.js subscriber. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing dependencies verified on npm
- Architecture: HIGH — all patterns replicate existing code (show/hide from dashboard.js:120-140, debounce from D-47, subscriber from auth.js/connectivity.js)
- Pitfalls: HIGH — verified against actual code (clearSession vs signOut, formatRate accessibility, retry bar z-index, header innerHTML rewrite, debounce timer leak)
- Security: MEDIUM — signOut/clearSession distinction confirmed by reading auth.js; onAuthChange handler extension confirmed by reading main.js

**Research date:** 2026-07-09
**Valid until:** 2026-08-09 (30 days — stable Capacitor ecosystem, no new packages)
