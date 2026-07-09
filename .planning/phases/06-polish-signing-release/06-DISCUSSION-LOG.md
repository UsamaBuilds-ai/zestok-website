# Phase 6: Polish, Signing & Release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 6-Polish, Signing & Release
**Areas discussed:** App icon, Splash screen, Keystore & signing, Version naming & build docs

---

## App Icon Design

| Option | Description | Selected |
|--------|-------------|----------|
| Text-based icon | App initials "SM" on dark background | ✓ (agent discretion) |
| Custom graphic icon | Bring custom PNG/vector design | |
| Generate via Android Asset Studio | Built-in Android Studio tool | ✓ (recommended) |
| Generate via @capacitor/assets CLI | Automated CLI tool | |

**User's choice:** Agent discretion — user deferred all decisions
**Notes:** Standard Android adaptive icon format with foreground/background layers. White "SM" foreground on `#1a1a2e` background.

---

## Splash Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Capacitor built-in splash | Already configured (2000ms, dark bg) | ✓ |
| Custom splash with logo | Show icon/logo on splash | |
| Fixed timer dismiss | Auto-hide after configured duration | ✓ |
| WebView-ready dismiss | Hide when webview reports loaded | |

**User's choice:** Agent discretion — user deferred all decisions
**Notes:** Keep existing Capacitor SplashScreen config. Center app name "Stock Management" in white on dark background.

---

## Keystore & Signing Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Self-signed keystore | Generate with keytool for dev/release | ✓ |
| Real certificate authority | Paid CA cert for production | |
| Gradle signing config | Standard Android build.gradle approach | ✓ |
| CLI apksigner | Manual apksigner step after build | |

**User's choice:** Agent discretion — user deferred all decisions
**Notes:** Keystore stored OUTSIDE repo. Passwords via environment variables. gradle signing config.

---

## Version Naming & Build Docs

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic versioning (1.0.0) | Standard semver | ✓ |
| Build number auto-increment | Per build in build.gradle | ✓ |
| Release documentation (RELEASE.md) | Document full build process | ✓ |

**User's choice:** Agent discretion — user deferred all decisions
**Notes:** Version 1.0.0 initial release. RELEASE.md produced for reproducible builds.

---

## the agent's Discretion

All four areas (app icon, splash screen, keystore/signing, versioning/build docs) were deferred to agent discretion by the user. Decisions documented in CONTEXT.md represent reasonable defaults following Android/Capacitor best practices and consistent with existing app patterns.

## Deferred Ideas

None — discussion stayed within phase scope.
