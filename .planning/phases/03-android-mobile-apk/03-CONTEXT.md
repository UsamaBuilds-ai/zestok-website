# Phase 3: Android Mobile APK - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a Capacitor/Ionic Android mobile app that connects to the desktop Express API on the local network. Features include QR code-based server pairing on first launch, PIN authentication on each app launch, a searchable stock list grouped by category (view-only), pull-to-refresh, error handling for network/server issues, and a buildable APK for direct distribution.
</domain>

<decisions>
## Implementation Decisions

### Server IP Config
- **D-01:** Desktop displays a QR code in the Settings dialog encoding the local IP address (IP only, port 3000 assumed)
- **D-02:** Mobile first launch opens QR scanner — user scans QR code from desktop screen to pair
- **D-03:** Server IP saved persistently in device local storage (Capacitor Preferences) — survives app restarts and reboots
- **D-04:** Mobile offers "Enter IP manually" link as fallback below QR scanner
- **D-05:** "Test Connection" button on IP setup screen verifies server reachability before proceeding
- **D-06:** If saved IP fails on app launch, show error with options to Edit IP or Retry

### PIN Storage
- **D-07:** PIN required on every app launch — not stored locally on device
- **D-08:** PIN required when app returns to foreground (from background/other apps)
- **D-09:** PIN entry uses numeric keypad only (like phone lock screen, 0-9 digits)
- **D-10:** After 3 wrong PIN attempts, show lockout with timer (30 seconds) before allowing retry

### Stock List Design
- **D-11:** Items displayed as list rows (not cards) — simple rows with separator lines
- **D-12:** Search bar is inline (scrolls with content, not fixed)
- **D-13:** Category headers use CSS animated gradient background (agent discretion on specific animation)
- **D-14:** Each item shows: item name, category badge, total quantity, new rate — minimal, no total value
- **D-15:** Category headers are sticky — stay at top while scrolling through that category's items

### Refresh Behavior
- **D-16:** Auto-refresh stock data when app comes to foreground (app.resume event)
- **D-17:** Pull-to-refresh gesture on stock list for manual refresh
- **D-18:** No timed auto-refresh while app is open — on-demand only (foreground + pull)
- **D-19:** Full-screen loading overlay displayed during data refresh
- **D-20:** "Last updated" timestamp shown in the app (e.g., "Updated: 2 min ago")

### Error States
- **D-21:** Server unreachable → Show error message "Cannot connect to server" with Retry button
- **D-22:** Wrong PIN (HTTP 401) → Shake animation on PIN input field + "Incorrect PIN" text
- **D-23:** PIN not configured (HTTP 200, configured: false) → Show "Server PIN not set up. Please configure PIN on the desktop app" with retry option
- **D-24:** Empty stock (all zero balances) → Show category headers but no items under them

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context (carries forward)
- `.planning/phases/01-postgresql-api-foundation/01-CONTEXT.md` — API endpoints (GET /api/stock, GET /api/pin/verify, GET /api/pin/status), rate limiting, error codes, bcrypt PIN hashing
- `.planning/phases/02-desktop-postgresql-integration-pin-management/02-CONTEXT.md` — Desktop shows IP in Settings dialog, QR code to be added, Express on port 3000, server status indicator

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Phase 3 requirements: MOB-01 through MOB-10
- `.planning/ROADMAP.md` — Phase 3 success criteria and boundaries
- `.planning/PROJECT.md` — Project context, constraints (view-only mobile, direct APK)

### Codebase Maps
- `.planning/codebase/STACK.md` — Technology stack (Express v5.2.1 API)
- `.planning/codebase/ARCHITECTURE.md` — System architecture, mobile API flow
- `.planning/codebase/INTEGRATIONS.md` — Express API is the mobile integration point
- `.planning/codebase/CONCERNS.md` — Known issues that mobile should handle

### API Contract (from Phase 1)
- `GET /api/stock` — Returns stock balance grouped by category, available items only (balance > 0), includes category info
- `GET /api/pin/verify` — Verify PIN from `x-access-pin` header. Returns 401 (wrong) or 200 valid. Rate limited.
- `GET /api/pin/status` — Returns `{ configured: true/false }`. 200 always.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Express API endpoints** (`src/server.js`): Mobile connects directly to these — no desktop code reuse for mobile
- **Stock data model** (from ARCHITECTURE.md): Entry model `{ id, date, type, item, category, quantity, rate, note, createdAt }`, Balance model `{ item, category, inQty, outQty, balance, latestRate, value }` — API returns balance model

### Established Patterns
- **Ionic/Capacitor**: Mobile app is a new project, separate codebase in `mobile/` directory. Reuses web technologies but is independent from Electron desktop
- **PIN auth pattern**: PIN sent via `x-access-pin` header to `/api/pin/verify`

### Integration Points
- **Express API** on `{serverIP}:3000` — mobile's only integration point
- **API paths**: `/api/stock` (GET), `/api/pin/verify` (GET), `/api/pin/status` (GET)
- **Desktop Settings dialog**: QR code display to be added in Phase 2 (or retrofitted after Phase 3)

</code_context>

<specifics>
## Specific Ideas

- Use Capacitor 6 with Ionic React for the mobile project (React is most popular, largest ecosystem for Ionic)
- Use Capacitor Camera plugin (@capacitor/camera) for QR scanning, or a dedicated QR scanner plugin
- Generate QR code on desktop using a simple JS library (qrcode.js or similar) in the Settings dialog
- APK build command: `ionic build` then `npx cap copy android && npx cap open android` then build from Android Studio (or `npx cap sync android && npx cap build android`)
- Capacitor Preferences plugin for persisting server IP
- Lockout timer stored in memory (not persisted) — resets when app is killed
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 3-Android Mobile APK*
*Context gathered: 2026-06-24*
