# Feature Landscape

**Domain:** PIN-authenticated read-only Android companion app for Zestok desktop system
**Researched:** 2026-07-07
**Mode:** Ecosystem research (mobile companion app features)

## Overview

This document maps the feature landscape for a Capacitor-based Android companion app that pairs with the Zestok desktop system. Features are categorized by whether they are table stakes (users expect them), differentiators (competitive advantage), or anti-features (things to deliberately avoid in v1).

---

## Table Stakes

Features users expect to see. Missing any of these makes the app feel incomplete or broken.

### Authentication & Session Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PIN entry screen on launch | Users need to authenticate before seeing data | Low | 4-6 digit numeric input, matches desktop pattern |
| "Forgot PIN?" handling | Users will inevitably forget their PIN | Low | Navigation hint: "Contact admin" or "Reset via desktop" |
| Session persistence across restarts | Users won't re-enter PIN on every app open | Medium | Store session token in Capacitor Preferences, check validity on launch |
| Automatic session expiry | Security requirement for sensitive business data | Low | Server-side token TTL; app detects 401 and redirects to PIN entry |
| Error state for invalid PIN | Users must know when PIN is wrong | Low | Inline error message, shake animation, clear input field |
| Loading state during PIN verification | Users need feedback during network calls | Low | Spinner/activity indicator while verifying |
| Server-unreachable fallback during auth | Users might open app without connectivity | Medium | Show "Server not reachable" with retry button; optionally verify against cached PIN hash |

### Dashboard — Metrics View

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Metric cards (4-card grid) | Mirror of desktop dashboard; core value proposition | Low | Total Items, Balance Qty, Stock Value, Today's Movement |
| Auto-refresh on app open | Users expect fresh data each time | Low | Fetch `/api/entries` on app foreground / on resume |
| Currency formatting (PKR Rs) | Localized display for Pakistani Rupees | Low | Match desktop: `Intl.NumberFormat("en-PK")` with Rs prefix |
| Numeric formatting with commas | Readability for large numbers | Low | `toLocaleString("en-PK")` for thousands separators |
| Dark mode / readable text outdoors | Mobile users are often on the go, in varied lighting | Medium | Either respect system dark mode or use high-contrast palette; stock management is often used in warehouses with bright lighting |

### Dashboard — Stock Balance Table

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Item list with stock balance | Core read-only view; the reason users open the app | Medium | Table with Item, Category, In, Out, Balance, Rate, Value |
| Search/filter by item name | Users need to find specific items quickly | Low | Case-insensitive text filter, debounced input |
| Scrollable table | Mobile screen is small; table must scroll | Low | Vertical scroll within table container |
| Empty state ("No stock found") | Users need to know search returned nothing | Low | Match desktop: "No stock balance found" message |

### Dashboard — Quick Rate Check

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Item rate lookup by name | Users on the go need quick price checks | Low | Text input with item name, displays latest rate + balance |
| Item autocomplete suggestions | Usability: don't make users type full names | Low | Datalist or dropdown populated from fetched items |

### Navigation & App Shell

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bottom navigation bar (2-3 tabs) | Mobile standard for primary navigation | Low | Dashboard, Rate Check tabs (Reports deferred to v2+) |
| Company name displayed in header | Users managing multiple locations need context | Low | From server response `company_name` |
| App version displayed somewhere | Users need to know what build they're on | Low | Settings screen or footer |
| Status bar / safe area handling | Avoids notch/cutout clipping on modern phones | Low | Capacitor StatusBar plugin + viewport-fit=cover meta |
| Back button handling (Android) | Users expect hardware back to exit or go up | Low | Override `backButton` event for appropriate navigation |
| Portrait orientation lock | Inventory tables are designed for portrait reading | Low | AndroidManifest `screenOrientation="portrait"` or Capacitor orientation lock |

---

## Differentiators

Features that set this app apart from a generic dashboard. Not expected, but deliver outsized value for the target audience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Pull-to-refresh dashboard data** | Gives users confidence data is fresh without restarting | Medium | Capacitor Gestures plugin or manual scroll-based implementation |
| **Offline-cached last-seen data** | Users can still see data even without connectivity | Medium | Cache last successful API response in Capacitor Preferences; show with "Last updated: X min ago" banner |
| **Stale-data indicator** | Prevents users from acting on outdated info | Low | Show timestamp of last successful fetch; highlight when > 5 min old |
| **Server health indicator** | Users know if the backend is reachable | Low | Small dot indicator (green/red) in header or settings, pings `/api/health` |
| **Rate check as a primary feature** | Stock rate lookup is a key quick-access need for managers | Low | Dedicated tab or search bar accessible from any screen |
| **Biometric unlock (fingerprint/face)** | Faster re-authentication than typing PIN each time | Medium | Capacitor Biometric plugin; fall back to PIN if biometrics unavailable |
| **Haptic feedback on PIN entry** | Feels more native and responsive on Android | Low | Vibrate on each digit press; subtle haptic on auth success/failure |
| **Item detail drill-down** | Tapping a stock item shows its full transaction history | Medium | New screen showing all in/out entries for that item; requires filtering `/api/entries` by item name |
| **Dashboard widget (homescreen)** | Users see total items/value without opening app | High | Android App Widget via Capacitor; complex for v1, consider for v2 |
| **Quick search shortcut (Android)** | Search directly from launcher long-press or spotlight | Medium | Android shortcut or app search provider |
| **Session persistence with encrypted storage** | Security-conscious business data | Medium | Encrypted Preferences plugin for token storage rather than plain text |

### Offline Support Strategy (Differentiator Cluster)

Offline support for a read-only dashboard is simpler than for a transactional app. The key differentiator is showing the **last-known-good data** rather than a blank screen:

| Offline Scenario | Approach | Complexity |
|-----------------|----------|------------|
| App opens with no connectivity | Show cached data + "Offline — last updated X ago" banner | Medium |
| User pulls to refresh while offline | Banner changes to "No connection — tap to retry" | Low |
| Connectivity restored | Auto-refresh data; banner dismisses | Medium |
| First launch with no cached data | Show "Connect to the internet to get started" screen | Low |
| Session token expired while offline | Prompt for PIN on next online launch | Low |

---

## Anti-Features

Features to explicitly NOT build in v1. These would increase complexity, risk, or scope without proportional benefit.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full transaction report with filters** | Desktop already handles this; mobile screen too small for complex tables | Keep to dashboard metrics + quick rate check; Reports deferred to v2 if requested |
| **Stock In/Out entry forms** | Project explicitly states read-only mobile; adds transactional complexity and data integrity risk | All mutations happen via desktop app |
| **CSV/PDF export** | Desktop already handles exports; mobile file management is OS-fragile | Not needed for a read-only companion |
| **Multi-language / i18n** | Premature; target audience is English/Urdu bilingual and comfortable with English UI | English-only v1; add i18n only if user demand emerges |
| **User registration / account management** | PIN is already scoped server-side per tenant; adding user accounts is scope creep | PIN-based auth is the model; no user profiles needed |
| **Push notifications** | Requires server-side changes (FCM setup, notification infrastructure) which is out of scope | Pull-to-refresh / auto-refresh on app open is sufficient |
| **Real-time WebSocket updates** | Requires server-side changes; overkill for a read-only dashboard | Auto-refresh on foreground + manual pull-to-refresh |
| **Theme customization (colors, fonts)** | Zero value for an internal business tool; adds UI maintenance burden | Use system dark/light mode or a single high-contrast theme |
| **Animations / splash screen** | Desktop already has a typewriter splash; mobile should prioritize speed-to-data | Minimal branded splash or no splash at all — show PIN gate immediately |
| **Deep linking / Universal links** | Not needed for an internal companion app with no shareable content | No shareable routes in v1 |
| **Onboarding tutorial** | Target users are already desktop users who understand the domain | Simple "Enter your PIN" screen — no tutorial needed |
| **Landscape / tablet layout** | v1 is phone portrait; tablet layout would double UI testing surface | Lock to portrait; tablet support only if analytics show demand |

---

## Feature Dependencies

```
PIN Authentication (gate)
├── Session persistence
│   └── Encrypted storage (optional differentiator)
├── Server health check
│
Dashboard (requires auth)
├── Metric cards ──────────────────────┐
├── Stock balance table                 ├── All depend on /api/entries data
├── Search/filter items ────────────────┘
├── Pull-to-refresh
├── Offline cached data
│   └── Stale-data indicator
│
Quick Rate Check (requires auth)
├── Item autocomplete ── depends on items list from /api/entries
├── Rate display
│
Settings / Info (requires auth)
├── App version
├── Server status
├── Sign out (clear session)
│
Biometric unlock (requires PIN auth first)
├── Only available after initial PIN verification
├── Must fall back to PIN if biometrics fail
```

---

## MVP Recommendation (v1)

The goal is a working app that delivers on the core value proposition: "Users can check current stock data from their phone at any time without needing access to the desktop app."

### Must Ship (Table Stakes)

| Priority | Feature | Category | Rationale |
|----------|---------|----------|-----------|
| P0 | PIN entry screen with server verification | Auth | Gate — nothing works without it |
| P0 | 4 metric cards (Total Items, Balance, Value, Movement) | Dashboard | Core value prop |
| P0 | Stock balance table with search | Dashboard | Core value prop |
| P0 | Quick rate check with autocomplete | Dashboard | Core value prop |
| P0 | Auto-refresh on app open | UX | Users expect fresh data |
| P0 | Loading and error states | UX | Without these the app feels broken |
| P1 | Bottom navigation (Dashboard / Rate Check) | Navigation | Standard mobile UX |
| P1 | Session persistence across restarts | Auth | Users won't re-enter PIN constantly |
| P1 | Empty states (no data, no results) | UX | Communicates state clearly |
| P1 | Dark/high-contrast theme | UX | Outdoor readability |

### Should Ship (Differentiators worth the effort)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P2 | Pull-to-refresh | High UX value for moderate effort |
| P2 | Offline cached last-seen data | High value for unreliable connectivity scenarios |
| P2 | Stale-data indicator | Complements offline support; prevents confusion |
| P2 | Server health indicator | Useful for troubleshooting |
| P3 | Biometric unlock | Friction reduction; moderate effort |
| P3 | Item detail drill-down | Adds depth to the dashboard |

### Defer to v2

| Feature | Deferral Reason |
|---------|-----------------|
| Homescreen widget | High complexity; platform-fragile |
| Push notifications | Requires server-side FCM setup (out of scope) |
| Reports view | Desktop handles this; mobile screen constraints |
| Landscape/tablet layout | Testing surface doubles for limited benefit |
| Multi-tenancy UI | Server handles this; no UI needed |

---

## Feature Complexity Reference

| Complexity | Effort Estimate | Risk Level | Examples |
|------------|----------------|------------|----------|
| **Low** | Hours to 1 day | Low | PIN screen, metric cards, search, formatting |
| **Medium** | 2-5 days | Medium | Session persistence, offline cache, pull-to-refresh, biometric unlock, item detail drill-down |
| **High** | 1-2 weeks | High | Homescreen widget, push notifications, real-time sync |

---

## Sources

- **Project context:** `.planning/PROJECT.md`, `src/index.html`, `src/renderer.js` (Zestok desktop app reference)
- **PIN auth patterns:** Industry standard for companion apps (banking apps, authenticator apps, enterprise portals) — 4-6 digit numeric PIN, server-side verification, optional biometric fallback
- **Mobile dashboard UX:** Material Design 3 guidelines for data display; inventory management mobile apps (Zoho Inventory, Odoo mobile, Lightspeed)
- **Capacitor patterns:** Capacitor v8 official documentation patterns for Preferences storage, network detection, and biometrics
- **Offline-first strategies:** Local-first software principles for read-heavy apps; cache-then-network pattern with stale-while-revalidate semantics
