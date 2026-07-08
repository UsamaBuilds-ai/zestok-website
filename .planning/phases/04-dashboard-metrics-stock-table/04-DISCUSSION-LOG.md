# Phase 4: Dashboard — Metrics & Stock Table - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 4-Dashboard — Metrics & Stock Table
**Areas discussed:** Post-auth screen flow, Metric cards layout, Offline cache strategy, Search & filter UX, Biometric unlock

---

## Post-Auth Screen Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Replace health check entirely | After PIN auth, swap health check UI for dashboard | ✓ |
| Keep health check + add dashboard | Show both — health check as status section alongside dashboard | |

**User's choice:** Agent decided (user selected "let the agent decide")
**Notes:** Health check is a bootstrap concern — once authenticated, data is what matters. Retry bar stays for transient errors during dashboard usage.

---

## Metric Cards Layout

| Option | Description | Selected |
|--------|-------------|----------|
| 2x2 grid | 4 cards arranged in 2 rows × 2 columns | ✓ |
| Horizontal scroll | Single row, user swipes to see all 4 | |
| Stacked list | Cards stacked vertically | |

**User's choice:** Agent decided
**Notes:** 2x2 grid is the standard mobile dashboard pattern — fits screen width and gives each card adequate space.

---

## Offline Cache Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Preferences cache | Store serialized entries in `@capacitor/preferences` | ✓ |
| Dedicated cache module | Separate file with cache management logic | |

**User's choice:** Agent decided
**Notes:** Preferences is already used for auth data — keeps dependencies minimal. Stale-data banner mirrors the session-expired banner pattern.

---

## Search & Filter UX

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time with debounce | Filter client-side with 300ms debounce | ✓ |
| Submit-on-enter | User types then presses Search/Enter | |

**User's choice:** Agent decided
**Notes:** Real-time filtering matches the Electron app pattern. 300ms debounce prevents jank on rapid typing.

---

## Biometric Unlock

| Option | Description | Selected |
|--------|-------------|----------|
| Biometric-first on resume | Try biometric first, fall back to PIN gate | ✓ |
| User chooses method | Show a choice screen on resume | |

**User's choice:** Agent decided
**Notes:** Uses `@capacitor/biometric` plugin. Biometric attempt happens on app resume before showing PIN gate. No enrollment screen — first success stores a flag.

---

## The Agent's Discretion

- Card styling details (colors, icons) — follow existing dark theme
- Search input placement — above stock table
- Pull-to-refresh or manual refresh button — standard mobile pattern
- Error state for dashboard data load — follow existing inline error/retry patterns

## Deferred Ideas

None — discussion stayed within phase scope.
