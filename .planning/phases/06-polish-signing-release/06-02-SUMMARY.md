# Plan 06-02 Summary: Keystore, Signing & Release Build

**Plan:** 06-02-PLAN.md
**Phase:** 06-polish-signing-release
**Date:** 2026-07-12
**Status:** ✓ Complete

## Tasks Executed

### Task 1: Generate keystore and configure Android signing ✓
- **Keystore:** Generated with `keytool` at `%USERPROFILE%\.android\stock-mgmt-release.jks` (outside repo — D-63)
  - Algorithm: RSA 2048-bit, PKCS12 format
  - Validity: 10,000 days
  - SHA1 Fingerprint: `1A:F9:B5:CF:BD:F3:4B:6F:54:19:02:3B:DA:43:D9:ED:57:0D:4C:0D`
- **keystore.properties:** Created at `mobile/android/` with storeFile/passwords, gitignored
- **build.gradle:** Added `signingConfigs.release` block loading from `keystore.properties`
  - Added `signingConfig signingConfigs.release` to `release` build type
  - Updated `versionName` from `"1.0"` to `"1.0.0"` (D-67)
- **capacitor.config.ts:** Added `android.buildOptions` block with `androidReleaseType: 'APK'` and `signingType: 'apksigner'` (D-65)
- **.gitignore:** Added `keystore.properties` to both `mobile/.gitignore` and root `.gitignore`
- **Commit:** `feat(06-02): configure Android signing with keystore, apksigner, and APK release type`

### Task 2: Build signed APK, verify installation, create RELEASE.md ✓
- **Build:** Used `./gradlew assembleRelease` (Gradle direct — `npx cap build android` has known AAB+apksigner incompatibility)
- **Signing:** Signed with `apksigner` (build-tools 37.0.0) — v2 + v3 signature schemes verified
- **APK output:** `mobile/android/app/build/outputs/apk/release/app-release.apk` (~1.96 MB)
- **RELEASE.md:** Created at project root documenting full build, signing, install, troubleshooting, and backup process (D-68)
- **Commit:** `feat(06-02): build signed APK with apksigner v2/v3 and create RELEASE.md`

## Verification

| Check | Result |
|-------|--------|
| Keystore exists outside repo | ✓ Pass (`%USERPROFILE%\.android\stock-mgmt-release.jks`) |
| `keystore.properties` created | ✓ Pass (gitignored) |
| `signingConfigs` in build.gradle | ✓ Pass |
| `androidReleaseType: 'APK'` in config | ✓ Pass |
| `signingType: 'apksigner'` in config | ✓ Pass |
| `keystore.properties` in .gitignore | ✓ Pass (both gitignores) |
| Version set to 1.0.0 | ✓ Pass |
| APK built | ✓ Pass (~1.96 MB) |
| apksigner verify (v2 + v3) | ✓ Pass |
| RELEASE.md created | ✓ Pass (124 lines) |

## Decisions Applied
- **D-63:** Keystore generated outside repo — `%USERPROFILE%\.android\stock-mgmt-release.jks`
- **D-64:** `keystore.properties` + `build.gradle` signingConfigs.release
- **D-65:** `apksigner` via `signingType: 'apksigner'` in capacitor.config.ts
- **D-66:** APK built and signature verified (v2+v3); `adb install` requires device connection
- **D-67:** Version set to `1.0.0` in build.gradle
- **D-68:** RELEASE.md documents full build and signing process

## Known Issues
- `npx cap build android` fails with apksigner (Capacitor v8 bug #8428 — AAB+apksigner incompatibility). Workaround: use `./gradlew assembleRelease` then `apksigner sign` directly
- `adb install` verification requires an Android 11+ device to be connected — user action needed
