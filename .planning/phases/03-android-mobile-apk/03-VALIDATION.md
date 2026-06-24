---
phase: 3
slug: android-mobile-apk
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + Android APK build |
| **Config file** | `mobile/vitest.config.ts` — Wave 0 |
| **Quick run command** | npx vitest run --reporter=verbose |
| **Full suite command** | npx vitest run --coverage |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Verify changed source files are syntactically valid
- **After every plan wave:** Launch mobile app in Android Studio emulator, test all modified features
- **Before `/gsd-verify-work`:** Full end-to-end workflow must work (scan QR or manual IP, PIN entry, stock list, search, pull-to-refresh, error states)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Verification | File Exists | Status |
|---------|------|------|-------------|-----------|-------------|-------------|--------|
| 03-01-01 | 1 | 1 | MOB-01, MOB-07, MOB-10 | manual | Ionic project created, Android platform added, APK builds | ❌ | ⬜ pending |
| 03-02-01 | 2 | 1 | MOB-02, MOB-09 | manual | PIN screen appears on launch, wrong PIN shows shake + error | ❌ | ⬜ pending |
| 03-02-02 | 2 | 1 | MOB-08 | manual | Auto-refresh triggers on app resume | ❌ | ⬜ pending |
| 03-02-03 | 2 | 1 | MOB-07, MOB-09 | manual | Server setup screen with QR scan + manual IP + test connection | ❌ | ⬜ pending |
| 03-03-01 | 3 | 2 | MOB-03, MOB-05 | manual | Stock list grouped by category, each item shows name/badge/qty/rate | ❌ | ⬜ pending |
| 03-03-02 | 3 | 2 | MOB-04 | manual | Search bar filters items by name | ❌ | ⬜ pending |
| 03-03-03 | 3 | 2 | MOB-06 | manual | Only available items (balance > 0) displayed | ❌ | ⬜ pending |
| 03-03-04 | 3 | 2 | MOB-09 | manual | Loading overlay shown during refresh, error state with Retry | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/` directory exists with Ionic React Capacitor project
- [ ] `@capacitor/android` platform added
- [ ] `@capacitor/app`, `@capacitor/preferences`, `@capacitor/barcode-scanner` installed
- [ ] `mobile/vitest.config.ts` created
- [ ] Express API is running and reachable (from Phase 1/2)
- [ ] Android Studio installed with JDK 17+
- [ ] Android SDK 26+ installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QR code scanning | MOB-07 | Requires camera on physical device | Scan desktop QR, verify IP saved and connection works |
| APK build | MOB-10 | Requires Android SDK + signing | Run `cd android && ./gradlew assembleRelease`, verify APK exists |
| Pull-to-refresh | MOB-08 | Requires touch gesture on device/emulator | Pull down on stock list, verify spinner and data refresh |
| PIN lockout | MOB-02 | Timing-dependent | Enter 3 wrong PINs, verify 30s lockout with countdown |
| Sticky headers | MOB-03 | Visual rendering | Scroll through categories, verify header sticks at top |
| Gradient animation | MOB-03 | Visual rendering | Check category headers have animated gradient background |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
