# Phase 3: Android Mobile APK - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 3-Android Mobile APK
**Areas discussed:** Server IP Config, PIN Storage, Stock List Design, Refresh Behavior, Error States

---

## Server IP Config

| Option | Description | Selected |
|--------|-------------|----------|
| First-launch setup screen | Show IP input before PIN. One-time setup. | ✓ |
| Settings page only | User must find settings to enter IP. | |
| No, manual only | User enters IP manually. Simple, reliable. | ✓ |
| Yes, MDNS/bonjour | Auto-discover server on LAN. | |
| Yes, save to local storage | Save IP using Capacitor Preferences. Persists across restarts. | ✓ |
| Enter every session | User enters IP each time they open app. | |
| Yes, 'Test Connection' | User taps button to test reachability before proceeding. | ✓ |
| No, just save and continue | Connection tested on next screen. | |
| Show port field too | IP + Port as separate fields. Port 3000 pre-filled. | User questioned IP entry |
| Fixed port 3000 | Only ask for IP address. | ✓ (port locked to 3000) |
| Show error + edit option | Cannot connect? Show error with Edit/Retry options. | ✓ |
| Auto-hide, manual only | Just show 'No connection' placeholder. | |

**User's choice:** QR code scan on first launch, manual IP fallback, persistent storage, test connection button, port fixed at 3000, error + edit/retry on connection failure
**Notes:** User preferred QR code over manual IP entry — QR displayed on desktop Settings dialog. QR contains IP only.

---

## PIN Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Never after first verify | Store PIN securely, no re-entry. | |
| Every app launch | Verify PIN on each launch. Most secure. | ✓ |
| Session timeout | Store PIN, require re-entry after idle timeout. | |
| Yes, on foreground too | Re-enter PIN when app comes from background. | ✓ |
| No, only on fresh launch | Only require PIN on fresh app launch. | |
| Numeric keypad only | 4-6 digit numeric keypad, like phone lock screen. | ✓ |
| Text input field (numeric) | Regular text input with numeric keyboard. | |
| Lockout with timer | 3 wrong attempts → 30 second lockout. | ✓ |
| No lockout | User can keep trying. | |

**User's choice:** PIN every launch + foreground, numeric keypad, lockout after 3 attempts

---

## Stock List Design

| Option | Description | Selected |
|--------|-------------|----------|
| Card style | Each item as card with shadow/rounded corners. | |
| List rows | Simple rows with separator lines. Lighter. | ✓ |
| Fixed top search bar | Always visible at top, even during scroll. | |
| Inline search | Scrolls with content. | ✓ |
| Sticky category headers | Bold text stays at top while scrolling through category. | ✓ |
| Regular headers | Bold text between groups, scrolls with content. | |
| Minimal | Name, category, qty, rate only. | ✓ |
| Add total value | Also show qty × rate. | |

**User's choice:** List rows, inline search, sticky animated category headers (CSS gradient — agent discretion), minimal item info
**Notes:** User wanted animated category headers with moving background. Agent will implement CSS gradient animation.

---

## Refresh Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, pull-to-refresh | User swipes down to manually refresh. | ✓ |
| No, auto only | Auto-refresh on foreground only. | |
| Yes, timed auto-refresh | Auto-refresh every N seconds while open. | |
| No, on-demand only | Foreground + pull-to-refresh only. | ✓ |
| Full-screen loading overlay | Show loading overlay during refresh. | ✓ |
| Spinner at top | Show spinner at top of list. | |
| Silent background refresh | Keep old data, replace silently. | |
| Yes, show last updated time | Show 'Updated: 2 min ago'. | ✓ |
| No timestamp | No last updated indicator. | |

**User's choice:** Pull-to-refresh + foreground refresh, no timed refresh, full-screen loading overlay, show last updated timestamp

---

## Error States

| Option | Description | Selected |
|--------|-------------|----------|
| Error + Retry button | 'Cannot connect to server' with Retry button. | ✓ |
| Empty state auto-retry | 'No connection' text. Auto-retry on foreground. | |
| Shake + error text | Shake animation + 'Incorrect PIN' below field. | ✓ |
| Access Denied screen | Full-screen 'Access Denied'. User must restart. | |
| Message + instructions | 'Configure PIN on desktop app' with retry. | ✓ |
| Empty screen | Show nothing. | |
| Empty state with icon | 'No items in stock' with empty box icon. | |
| Show empty categories | Keep category headers visible, no items. | ✓ |

**User's choice:** Error + Retry for server down, shake + text for wrong PIN, instructions for no PIN, empty categories for zero stock

---

## Agent's Discretion

- **Animated category headers**: CSS gradient animation (simple, performant) — agent choice per user's "if easy, otherwise you decide"
- **Mobile framework**: Ionic React (recommended by agent based on ecosystem size)
- **QR code library**: qrcode.js (npm) for desktop generation, camera plugin for mobile scanning

## Deferred Ideas

None.
