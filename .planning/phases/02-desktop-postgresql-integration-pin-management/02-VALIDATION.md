---
phase: 2
slug: desktop-postgresql-integration-pin-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (Electron desktop app + Express API) |
| **Config file** | none — Wave 0 installs dependencies |
| **Quick run command** | Start desktop app, verify no startup errors |
| **Full suite command** | Desktop app running, all 5 success criteria verified |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Verify changed source files are syntactically valid
- **After every plan wave:** Launch desktop app, test all modified features
- **Before `/gsd-verify-work`:** Full end-to-end workflow must work
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Verification | File Exists | Status |
|---------|------|------|-------------|-----------|-------------|-------------|--------|
| 02-01-01 | 1 | 1 | DKT-01, DKT-02 | integration | Desktop loads data from PG, saves new entries to PG | ✅ | ⬜ pending |
| 02-01-02 | 1 | 1 | DKT-05 | integration | Express auto-starts on app launch, closes on quit | ✅ | ⬜ pending |
| 02-02-01 | 2 | 2 | DKT-03 | manual | PIN settings modal opens, set/change PIN works | ✅ | ⬜ pending |
| 02-02-02 | 2 | 2 | DKT-04 | manual | Local IP displayed correctly in settings dialog | ✅ | ⬜ pending |
| 02-03-01 | 3 | 3 | DKT-01, DKT-02 | integration | JSON fallback loads when PG is down | ✅ | ⬜ pending |
| 02-03-02 | 3 | 3 | DKT-01 | integration | Auto-export to JSON on app exit | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` updated with: `pg`, `dotenv`, `bcryptjs`
- [ ] `.env` file present (from Phase 1)
- [ ] PostgreSQL running with `stock_db` and `app_settings` table (from Phase 1)

*Existing infrastructure covers basic project setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PIN settings modal | DKT-03 | Requires Electron window interaction | Click gear icon, set PIN, verify via API |
| IP display | DKT-04 | Network-dependent, varies per machine | Open settings, verify IP matches `ipconfig` |
| Server status indicator | DKT-05 | Visual element in app footer | Launch app, verify green dot + "Running" text |
| JSON auto-export | DKT-01 | On-app-exit behavior | Launch app, add entries, close app, check JSON file |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
