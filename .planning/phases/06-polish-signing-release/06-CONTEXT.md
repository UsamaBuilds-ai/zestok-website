# Phase 6: Polish, Signing & Release - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Final app packaging and release. Configure app icon and splash screen, generate a keystore, sign the APK, and verify the signed build installs and runs correctly on Android 11+. This phase produces the distributable APK and documents the build process for future releases.

</domain>

<decisions>
## Implementation Decisions

### App Icon
- **D-59:** Generate standard Android adaptive icon using a simple text-based design — app initials "Z" centered on the existing dark theme background (`#1a1a2e`). Use Android Asset Studio (built into Android Studio) or `@capacitor/assets` to produce all required densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi).
- **D-60:** Icon assets stored in `mobile/android/app/src/main/res/` (standard Android location). Source icon file kept in `mobile/` (gitignored) or generated from a script.

### Splash Screen
- **D-61:** Use Capacitor's built-in SplashScreen plugin (already configured in `capacitor.config.ts` with 2000ms duration and `#1a1a2e` background). Center the app name "Zestok" in white text on the dark background as the splash content.
- **D-62:** Splash auto-hides after the configured duration — no custom dismissal logic needed (matches the existing config). Add `launchAutoHide: true` if not already default.

### Keystore & APK Signing
- **D-63:** Generate a self-signed keystore via `keytool` for release signing. Keystore file (`.jks`/`.keystore`) stored OUTSIDE the repository — in developer's secure local storage. Document its location in a gitignored `.env` file.
- **D-64:** Signing configuration goes in `mobile/android/app/build.gradle` (standard Android approach) — references keystore path, passwords, alias via environment variables or a local `keystore.properties` (gitignored).
- **D-65:** Use `apksigner` (wrapped by Capacitor's `npx cap open android` → Android Studio Build → Generate Signed Bundle/APK, or CLI via `./gradlew assembleRelease` with signing pre-configured).
- **D-66:** After building, verify the APK installs on Android 11+ via `adb install <apk>` and all existing features work in the signed release build (PIN auth, dashboard, rate check, settings, biometric, offline).

### Versioning & Release Documentation
- **D-67:** Use semantic versioning — initial release is `1.0.0`. Version name in `mobile/android/app/build.gradle` (or `capacitor.config.ts`). Version code starts at `1`, incremented per release.
- **D-68:** Produce a `RELEASE.md` in the project root documenting the full build and signing process — prerequisites, environment setup, keystore generation, signing configuration, build commands, installation verification steps. This enables reproducible builds.

### The Agent's Discretion
- Exact icon design details (font choice, text size, shape — standard Android adaptive icon format with foreground/background layers)
- Splash screen implementation detail (pure CSS/HTML splash vs native — Capacitor SplashScreen plugin handles native layer, standard approach)
- Whether to use `@capacitor/assets` CLI or manual PNG generation for icon densities
- Keystore alias name and password patterns (documented but not hardcoded)
- Whether signing is done via Android Studio GUI or CLI-only
- Exact content of RELEASE.md (agent follows standard mobile release documentation conventions)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Requirements
- `.planning/ROADMAP.md` §Phase 6 — Phase goal, success criteria, plan outline
- `.planning/REQUIREMENTS.md` §Release (REL-01 through REL-03) — Full requirements traceability

### Active Decisions from Prior Phases
- `.planning/phases/01-project-setup-toolchain/01-CONTEXT.md` — Capacitor project setup, config decisions
- `.planning/codebase/STACK.md` — Technology stack (Capacitor v8, Android SDK 36, Vite)
- `.planning/codebase/ARCHITECTURE.md` — System architecture, data flow

### Codebase Reference
- `mobile/capacitor.config.ts` — Current Capacitor config (splash already partially configured)
- `mobile/android/app/build.gradle` — Android build config (signing, versioning goes here)
- `mobile/android/app/src/main/res/` — Android resource directory (icon and splash go here)
- `mobile/package.json` — App version, build scripts
- `mobile/src/style.css` — Theme colors to match icon/splash (`#1a1a2e`, text colors)

### Architecture & Stack
- `.planning/codebase/STACK.md` — Capacitor v8, vanilla JS stack
- `.planning/codebase/CONVENTIONS.md` — Coding standards
- `.planning/codebase/CONCERNS.md` §Unused Capacitor dependency — Notes about Android platform state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/capacitor.config.ts:13-15` — SplashScreen plugin already configured with 2000ms duration and `#1a1a2e` background — extend rather than replace
- `mobile/android/` — Android platform already scaffolded (from Phase 1), ready for resource injection and signing config
- `mobile/package.json` — Build scripts (`cap:sync`, `cap:run:android`) available for pre-release workflows

### Established Patterns
- **Config-first approach** — Capacitor configuration in `capacitor.config.ts` is the single source of truth for app-level settings; signing config follows standard Android `build.gradle` pattern
- **Environment variables for secrets** — Prior phases established pattern of `.env` + gitignore for sensitive data; keystore passwords follow same pattern
- **Dark theme** — Full app uses `#1a1a2e` dark background; icon and splash should match this aesthetic

### Integration Points
- `mobile/android/app/build.gradle` — Signing configuration block (`signingConfigs { release { ... } }`) needs to be added
- `mobile/android/app/src/main/res/` — `mipmap-*` directories need icon PNGs; `drawable-*` or `values/` for splash
- `mobile/capacitor.config.ts` — SplashScreen plugin config may need `androidSplashResourceName` or similar if customizing beyond built-in
- `mobile/android/app/src/main/res/values/styles.xml` — App theme may need updating for splash screen styling

</code_context>

<specifics>
## Specific Ideas

- App icon: standard Android adaptive icon format (foreground + background layers) — foreground "Z" text in white on transparent, background layer matches app theme `#1a1a2e`
- Splash: simple centered white text "Zestok" on `#1a1a2e` background, no logo needed for v1
- Keystore: `keytool -genkey -v -keystore release.keystore -alias zestok -keyalg RSA -keysize 2048 -validity 10000`
- Release build: `cd mobile/android && ./gradlew assembleRelease` produces unsigned APK, signing step follows
- Verification: `adb install mobile/android/app/build/outputs/apk/release/app-release.apk`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Polish, Signing & Release*
*Context gathered: 2026-07-09*
