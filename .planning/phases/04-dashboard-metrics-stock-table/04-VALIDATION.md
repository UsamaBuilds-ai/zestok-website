---
phase: 4
slug: dashboard-metrics-stock-table
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed |
| **Config file** | None |
| **Quick run command** | No test command defined |
| **Full suite command** | No test command defined |
| **Estimated runtime** | N/A — all manual |

---

## Sampling Rate

- **After every task commit:** Manual verification against acceptance criteria
- **After every plan wave:** Manual integration test on device/emulator
- **Before `/gsd-verify-work`:** Full manual UAT against phase success criteria
- **Max feedback latency:** Immediate (manual check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DASH-01, DASH-02 | — | N/A (client-side formatting) | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DASH-01, DASH-02 | T-04-01, T-04-02 | x-access-pin header on data fetch | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | DASH-01, DASH-02, DASH-03, UI-02 | T-04-03 | 10s AbortController timeout | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | DASH-04, DASH-05, DASH-06, UI-02 | — | N/A (client-side rendering) | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | DASH-04, DASH-05 | — | N/A (client-side filter) | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | CONN-03 | — | Cached data served from Preferences | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | CONN-03 | — | Stale-data banner pattern | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | UX-04 | — | Biometric auth through native plugin | manual-only | N/A | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 2 | UX-04 | — | Fallback to PIN gate on biometric failure | manual-only | N/A | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
❌ W0 = Wave 0 gap — test infrastructure not yet installed

---

## Wave 0 Requirements

- [ ] No test framework established for mobile/ project
- [ ] No shared test fixtures for dashboard data (entries JSON, balance calculations)
- [ ] Recommendation: If automated testing is desired, add vitest or similar framework as a separate phase or Wave 0 task

*Existing infrastructure does not cover phase requirements. All verification is manual-only for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 4 metric cards displayed in 2x2 grid with correct values | DASH-01, DASH-02 | No UI test framework | Launch app, authenticate, verify metric cards show (Total Items, Balance Qty, Stock Value, Today's Movement) with PKR Rs formatting |
| Stock balance table with 7 columns, scrollable | DASH-04 | No UI test framework | After auth, scroll stock table vertically; verify all 7 columns render |
| Search filters stock table by name/category | DASH-05 | No UI test framework | Type partial item name or category in search bar; verify table filters instantly (300ms debounce) |
| Empty state when no data | DASH-06 | No UI test framework | Use a tenant with no entries; verify "No stock balance found" message |
| Offline cache shows stale-data banner | CONN-03 | No UI test framework | Disconnect network, open dashboard; verify cached data displays with "Stale data — last updated" banner (5s auto-dismiss) |
| Biometric unlock on resume | UX-04 | Physical device/emulator only | Lock device, reopen app; verify biometric prompt appears; on success, skip PIN gate |
| PIN fallback on biometric cancel | UX-04 | Physical device/emulator only | Cancel biometric prompt; verify PIN gate appears instead |
| Touch targets ≥44px | UI-02 | No UI test framework | Inspect CSS — verify all interactive elements have min-height/width ≥44px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
