---
phase: 5
slug: quick-rate-check-navigation-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Capacitor mobile app (vanilla JS) |
| **Config file** | None |
| **Quick run command** | No test command defined |
| **Full suite command** | No test command defined |
| **Estimated runtime** | Manual only |

---

## Sampling Rate

- **After every task commit:** Manual verification of the specific component changed
- **After every plan wave:** Manual tab switching + sign-out flow
- **Before `/gsd-verify-work`:** Full manual UAT against all 5 success criteria
- **Max feedback latency:** Manual only

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-** | ** | 1 | DASH-07 | — / N/A | N/A | manual | N/A | ❌ Wave 0 | ○ pending |
| 05-** | ** | 1 | DASH-08 | — / N/A | N/A | manual | N/A | ❌ Wave 0 | ○ pending |
| 05-** | ** | 1 | DASH-09 | — / N/A | N/A | manual | N/A | ❌ Wave 0 | ○ pending |
| 05-** | ** | 1 | UI-01 | — / N/A | N/A | manual | N/A | ❌ Wave 0 | ○ pending |
| 05-** | ** | 1 | UI-03 | — / N/A | N/A | manual | N/A | ❌ Wave 0 | ○ pending |
| 05-** | ** | 1 | UI-04 | T-05-01 / D-58 | signOut() clears accessPin + biometricEnabled, preserves pinHash + cachedEntries | manual | N/A | ❌ Wave 0 | ○ pending |

---

## Wave 0 Requirements

- [ ] No test framework — all verification is manual

*Existing infrastructure covers no phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rate check input | DASH-07 | No test infrastructure | Type partial item name, verify results display |
| Autocomplete dropdown | DASH-08 | No test infrastructure | Type partial name, verify matching items appear, non-match shows "No items found" |
| Rate + balance display | DASH-09 | No test infrastructure | Select item, verify PKR rate and qty balance show correctly |
| Bottom nav tab switching | UI-01 | No test infrastructure | Tap each tab, verify view switches and active tab highlight follows |
| Settings: app version | UI-03 | No test infrastructure | Open Settings, verify app version string is displayed |
| Sign-out clears session | UI-04 | No test infrastructure | Tap sign-out, verify PIN gate appears. Close/reopen app, verify PIN still required |
| Offline PIN after sign-out | D-57 | No test infrastructure | After sign-out, go offline, re-enter PIN — verify it works (pinHash preserved) |
| Header text per tab | D-54 | No test infrastructure | Switch tabs, verify header text updates. Verify network badge not destroyed |
| Health check in Settings | D-56 | No test infrastructure | Verify spinner, "Connected"/"Unreachable" states, retry on failure |
| Bottom nav + retry bar | Research | No test infrastructure | When retry bar appears (simulate error), verify visible above nav. When dismissed, nav is fully visible |

---

## Validation Sign-Off

- [ ] All tasks have manual verify steps
- [ ] Sampling continuity: manual verification after each commit
- [ ] Wave 0 covers no MISSING references (no test framework to install)
- [ ] No watch-mode flags
- [ ] Feedback latency: manual only
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending