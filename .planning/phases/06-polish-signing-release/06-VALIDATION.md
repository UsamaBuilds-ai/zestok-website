---
phase: 06
slug: polish-signing-release
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

This phase produces a signed, installable APK. Primary validation is installation + manual smoke test.

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke test + `adb install` verification |
| **Config file** | N/A |
| **Quick run command** | `adb install mobile/android/app/build/outputs/apk/release/app-release.apk` |
| **Full suite command** | Manual: launch app, verify PIN auth, dashboard, rate check, settings, sign-out |
| **Estimated runtime** | ~10 minutes |

---

## Sampling Rate

- **After every task commit:** N/A — no code changes to unit-test
- **After every plan wave:** Manual smoke test of signed APK
- **Before `/gsd-verify-work`:** APK installs successfully + all features work in release build
- **Max feedback latency:** 600 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 06-01-01 | 01 | 1 | REL-02 | Manual | Visual: app icon shows "SM" on dark bg | ⬜ pending |
| 06-01-02 | 01 | 1 | REL-02 | Manual | Visual: splash shows "Stock Management" white on `#1a1a2e` | ⬜ pending |
| 06-02-01 | 02 | 1 | REL-03 | Audit | Verify keystore exists at documented location | ⬜ pending |
| 06-02-02 | 02 | 1 | REL-01 | Smoke | `adb install .../app-release.apk && adb shell am start` | ⬜ pending |
| 06-02-03 | 02 | 1 | REL-01 | Manual | Launch app, verify all features in release build | ⬜ pending |

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements — no automated test framework needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App icon displayed | REL-02 | Visual inspection required | Install APK, check home screen icon shows "SM" on `#1a1a2e` |
| Splash screen on launch | REL-02 | Visual inspection required | Launch app, verify "Stock Management" splash shown briefly |
| All features in release build | REL-01 | End-to-end functional test | Launch signed APK, test PIN auth, dashboard, rate check, settings, sign-out |

---

## Validation Sign-Off

- [ ] All tasks have verification method defined
- [ ] Sampling continuity maintained
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 600s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
