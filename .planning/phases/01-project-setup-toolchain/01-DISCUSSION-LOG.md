# Phase 1: Project Setup & Toolchain - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 1-Project Setup & Toolchain
**Areas discussed:** App identity & Capacitor config

---

## App Identity & Capacitor Config

| Option | Description | Selected |
|--------|-------------|----------|
| `com.zestok.mobile` | Simple, matches project name | (agent decided) |
| `com.yourcompany.zestok` | Reverse-domain with company | |
| (other) | Let the agent decide | ✓ |

**User's choice:** Let the agent decide
**Notes:** Agent chose `com.zestok.mobile`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Zestok | Matches desktop branding | (agent decided) |
| Stock Mgmt | Shorter, mobile-friendly | |
| (other) | Let the agent decide | ✓ |

**User's choice:** Let the agent decide
**Notes:** Agent chose "Zestok" for clear branding

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode in capacitor.config.ts | Simple, direct | (agent decided) |
| Use .env or runtime config | More flexible | |
| (other) | Let the agent decide | ✓ |

**User's choice:** Let the agent decide
**Notes:** Agent chose hardcoding server.url in capacitor.config.ts with cleartext: true — simplest approach for Phase 1

---

| Option | Description | Selected |
|--------|-------------|----------|
| Defaults are fine | Use Capacitor defaults | |
| Customize webDir | Set specific webDir path | |
| Configure plugins upfront | Pre-configure plugins | ✓ |

**User's choice:** Configure plugins upfront
**Notes:** User chose to configure SplashScreen, StatusBar, Preferences, App, and Network plugins in capacitor.config.ts

---

## the agent's Discretion

- Android SDK targeting (compileSdk, targetSdk, minSdk)
- Initial app content on first launch
- Android network_security_config.xml details
- Package.json scripts for capacitor commands

## Deferred Ideas

None — discussion stayed within phase scope.
