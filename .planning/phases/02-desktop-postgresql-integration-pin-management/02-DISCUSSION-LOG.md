# Phase 2: Desktop PostgreSQL Integration + PIN Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 2-Desktop PostgreSQL Integration + PIN Management
**Areas discussed:** Desktop→DB Connection, PIN Settings UI, Express Auto-Start, JSON File Strategy

---

## Desktop→DB Connection

| Option | Description | Selected |
|--------|-------------|----------|
| Direct PG via `pg` | Main process uses `pg` package directly. Simple, no extra hop. | ✓ |
| Via Express API | Desktop calls localhost:3000 internally. Adds HTTP overhead. | |
| Same `.env` as Express | Single `.env` file shared by Express and desktop. One source of truth. | ✓ |
| Separate electron config | Store DB config in Electron's userData. More isolated. | |
| On app startup | Check PG connection when app launches. Show error if unreachable. | ✓ |
| On first data operation | Try to connect only when user loads dashboard or saves entry. | |
| Show error, block usage | Display error and prevent data entry until connection restored. | ✓ |
| Read from last cached data | Allow browsing cached data, block writes only. | |

**User's choice:** Direct PG via `pg`, shared `.env`, startup verification, block usage if PG down
**Notes:** None

---

## PIN Settings UI

| Option | Description | Selected |
|--------|-------------|----------|
| New Settings tab | Add 4th tab alongside Dashboard/Entry/Report. | |
| Modal/dialog | Open from gear icon in header. Less prominent. | ✓ |
| Set PIN + Change PIN | New: PIN + Confirm. Existing: Current + New + Confirm. | ✓ |
| Single field only | Simple "Enter new PIN" field. Less secure. | |
| On same page as IP | Show IP address on Settings dialog alongside PIN controls. | ✓ |
| IP in separate area | Show IP in status bar/footer, separate from PIN. | |
| 4-6 digits only | Numeric PIN like phone lock screen. Easy on mobile. | ✓ |
| 4-8 alphanumeric | Allow letters+numbers. More secure but harder to type. | |

**User's choice:** Modal dialog, Set PIN (new) + Change PIN (existing), IP on same dialog, 4-6 numeric digits
**Notes:** None

---

## Express Auto-Start

| Option | Description | Selected |
|--------|-------------|----------|
| On app `ready` event | Start server when Electron initializes, before window opens. | ✓ |
| On window creation | Start when createWindow() is called. | |
| On `before-quit` / `will-quit` | Gracefully close server on app close. Clean port release. | ✓ |
| Let process die naturally | Express stops when Electron exits. No explicit close. | |
| Agent discretion (port conflict) | User deferred to agent: dialog with Retry/Alternative/Cancel | ✓ |
| Show error + exit | Display error dialog. User must free port. | |
| Try next port | Auto-fallback to 3001. Display chosen port. | |
| Yes, indicator in footer | Small icon/text showing Server: Running/Stopped. | ✓ |
| No, background only | Server runs silently. | |

**User's choice:** Start on `ready`, stop on `before-quit`, agent discretion for port conflict (dialog approach), status indicator in footer
**Notes:** User said "ap khud se dheko" (you decide) for port conflict strategy

---

## JSON File Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only fallback | Keep JSON file for fallback if PG is unreachable. | ✓ |
| Remove completely | JSON file obsolete. PG only. | |
| Keep for backup export | Keep writing JSON as backup alongside PG. | |
| PG is source of truth | Desktop loads from PG. JSON only as fallback. | ✓ |
| Merge on startup | Check both sources, merge missing entries. | |
| Auto-export on exit | User chose: auto-export to JSON when app exits | ✓ |

**User's choice:** JSON as read-only fallback, PG source of truth, auto-export on app exit
**Notes:** Auto-exports current data to JSON when user exits the app. On next startup, if PG is down, reads from last exported JSON.

---

## Desktop Data Ops

User chose to skip this area.

## Agent's Discretion

- **Port conflict handling** (Express Auto-Start): Show dialog with Retry / Use alternative port / Cancel options. Display chosen port in status indicator.

## Deferred Ideas

None.
