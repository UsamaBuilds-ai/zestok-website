# Phase 5: Quick Rate Check & Navigation Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 5-Quick Rate Check & Navigation Shell
**Areas discussed:** Bottom Nav Structure, Rate Check UX, Settings Screen Content, Sign-Out Flow

---

## Bottom Navigation Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Nav tabs + view sections | Bottom nav buttons toggle visibility of view divs — matches current show/hide pattern | ✓ |
| Content area swap | Single content container, innerHTML swap per tab | |

**User's choice:** Nav tabs + view sections
**Notes:** User selected the show/hide view sections approach that matches the existing Phase 4 dashboard pattern.

---

## Rate Check UX

| Option | Description | Selected |
|--------|-------------|----------|
| Filter local balances | User types → filter _balances array by item name (300ms debounce) → dropdown → select shows rate + balance | |
| You decide | Agent discretion to implement autocomplete approach | ✓ |

**User's choice:** Agent decide
**Notes:** User deferred to agent. Agent will implement local _balances filtering approach since data is already client-side and no separate API endpoint exists.

---

## Settings Screen Content

| Option | Description | Selected |
|--------|-------------|----------|
| Company name + health | Show company name (from session), live server health status, app version, sign-out | ✓ |
| Minimal | Just app version and sign-out button | |
| You decide | Agent decides contents | |

**User's choice:** Company name + health
**Notes:** User wants company name from session, live server health status, app version, and sign-out on the settings screen.

---

## Sign-Out Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm then clear | Confirmation dialog → clear PIN, pinHash, cachedEntries → PIN gate | |
| Clear immediately | No confirmation, clear and go to PIN gate | ✓ |
| You decide | Agent decides | |

**User's choice:** Direct sign-out to PIN gate — keep pinHash and cachedEntries
**Notes:** User wants immediate sign-out (no confirmation). Clear accessPin and biometricEnabled from Preferences. Do NOT clear pinHash (for offline PIN re-entry) or cachedEntries (for offline data). Returns to PIN gate immediately.

---

## The Agent's Discretion

The following areas were deferred to the agent:
- Bottom nav bar visual styling (color, height, active indicator)
- Rate check autocomplete dropdown style
- Settings layout (list vs cards)
- App version source
- Rate check display format (reuse `formatRate()`/`formatQty()`)
- Header text per tab
- Empty state handling for rate check

## Deferred Ideas

None — discussion stayed within phase scope.