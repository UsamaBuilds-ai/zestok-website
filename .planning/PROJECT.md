# Zestok — Mobile Companion

## What This Is

A read-only Android companion app for the Zestok desktop system. Users enter a PIN to authenticate against the existing backend server, then view live inventory analytics — metrics, stock balance, and rate checks — directly from their phone. Built for business owners and managers who need quick stock visibility on the go.

## Core Value

Users can check current stock data from their phone at any time without needing access to the desktop app.

## Business Context

- **Customer**: Zestok desktop app users who want mobile access
- **Revenue model**: Bundled with the existing desktop system
- **Success metric**: Users can authenticate and view accurate dashboard data within 3 seconds of app launch

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **AUTH-01**: User can enter a PIN code on app launch
- [ ] **AUTH-02**: App validates PIN against existing server (`/api/pin/verify`)
- [ ] **AUTH-03**: Invalid PIN displays error — no data shown
- [ ] **AUTH-04**: Valid session persists across app restarts
- [ ] **DASH-01**: User sees metric cards (Total Items, Balance Qty, Stock Value, Today's Movement)
- [ ] **DASH-02**: User sees current stock balance table with item search
- [ ] **DASH-03**: User can check item rates by name
- [ ] **DASH-04**: Dashboard data refreshes on each app open

### Out of Scope

- Stock Entry/Edit — mobile app is read-only; the desktop app handles In/Out transactions
- Reports & Export — desktop app handles CSV/PDF export and transaction reports
- Server-side PIN/TOTP changes — already handled by the existing server
- Multi-user management — PIN scoping handled server-side per tenant
- iOS version — Android-only for v1

## Context

- Existing backend server at `http://84.235.249.239:3000/api` provides all required endpoints (`/api/pin/verify`, `/api/entries`, `/api/health`)
- PIN authentication with optional TOTP 2FA already exists server-side
- Electron desktop app source (`src/`) provides reference for API call patterns and data shapes
- `@capacitor/android` v8 is already a dependency in `package.json`
- No Capacitor configuration or Android platform has been initialized yet
- This is the developer's first mobile project — simplicity is a priority

## Constraints

- **Tech Stack**: Capacitor v8 (web-based Android) — must use existing @capacitor/android dependency
- **Compatibility**: Must work with the existing server API — no server-side changes
- **Output**: Must produce a signed APK ready for sideloading or distribution
- **Platform**: Android only — no iOS for v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Capacitor (vs Flutter/Native) | Already in deps, reuse JS skills from Electron app | — Pending |
| PIN-only auth (no TOTP) | Read-only app; simpler UX; 2FA can be added later if needed | — Pending |
| Mobile-specific UI (not reusing Electron UI) | Desktop UI not optimized for touch/small screens | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-07 after initialization*
