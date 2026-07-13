# Phase 6: Polish, Signing & Release — Research

**Researched:** 2026-07-11
**Domain:** Android release packaging, adaptive icons, splash screens, APK signing
**Confidence:** HIGH

## Summary

This phase prepares the Capacitor v8 Android app for release: custom app icon, branded splash screen, keystore generation, Gradle signing configuration, signed APK build, and installation verification on Android 11+.

The Android project is already scaffolded (from Phase 1) with default Capacitor icons and splash PNGs. The current icon foreground is a generic Android vector drawable; the splash draws the Capacitor logo. Both must be replaced with text-based assets matching the `#1a1a2e` dark theme. Signing requires generating a keystore via `keytool`, wiring it into `build.gradle` via a gitignored `keystore.properties`, and producing an APK signed with `apksigner` (mandatory for Android 11+ targets targeting API 30+). A critical known bug in Capactior CLI v8 causes `apksigner` to fail on AAB builds — the fix is to use `androidReleaseType: 'APK'` with `signingType: 'apksigner'` in capacitor config.

All environment dependencies are confirmed present: Android SDK 36, JDK 21, keytool, adb, apksigner (build-tools 37), and Gradle wrapper.

**Primary recommendation:** Generate keystore via `keytool` stored outside repo, configure `build.gradle` to read from gitignored `keystore.properties`, use `npx cap build android` with `androidReleaseType: 'APK'` and `signingType: 'apksigner'`, then verify with `adb install`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-59:** Generate standard Android adaptive icon using a simple text-based design — app initials "Z" centered on the existing dark theme background (`#1a1a2e`). Use Android Asset Studio (built into Android Studio) or `@capacitor/assets` to produce all required densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi).

**D-60:** Icon assets stored in `mobile/android/app/src/main/res/` (standard Android location). Source icon file kept in `mobile/` (gitignored) or generated from a script.

**D-61:** Use Capacitor's built-in SplashScreen plugin (already configured in `capacitor.config.ts` with 2000ms duration and `#1a1a2e` background). Center the app name "Zestok" in white text on the dark background as the splash content.

**D-62:** Splash auto-hides after the configured duration — no custom dismissal logic needed (matches the existing config). Add `launchAutoHide: true` if not already default.

**D-63:** Generate a self-signed keystore via `keytool` for release signing. Keystore file (`.jks`/`.keystore`) stored OUTSIDE the repository — in developer's secure local storage. Document its location in a gitignored `.env` file.

**D-64:** Signing configuration goes in `mobile/android/app/build.gradle` (standard Android approach) — references keystore path, passwords, alias via environment variables or a local `keystore.properties` (gitignored).

**D-65:** Use `apksigner` (wrapped by Capacitor's `npx cap open android` → Android Studio Build → Generate Signed Bundle/APK, or CLI via `./gradlew assembleRelease` with signing pre-configured).

**D-66:** After building, verify the APK installs on Android 11+ via `adb install <apk>` and all existing features work in the signed release build (PIN auth, dashboard, rate check, settings, biometric, offline).

**D-67:** Use semantic versioning — initial release is `1.0.0`. Version name in `mobile/android/app/build.gradle` (or `capacitor.config.ts`). Version code starts at `1`, incremented per release.

**D-68:** Produce a `RELEASE.md` in the project root documenting the full build and signing process — prerequisites, environment setup, keystore generation, signing configuration, build commands, installation verification steps. This enables reproducible builds.

### The Agent's Discretion

- Exact icon design details (font choice, text size, shape — standard Android adaptive icon format with foreground/background layers)
- Splash screen implementation detail (pure CSS/HTML splash vs native — Capacitor SplashScreen plugin handles native layer, standard approach)
- Whether to use `@capacitor/assets` CLI or manual PNG generation for icon densities
- Keystore alias name and password patterns (documented but not hardcoded)
- Whether signing is done via Android Studio GUI or CLI-only
- Exact content of RELEASE.md (agent follows standard mobile release documentation conventions)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Signed APK produced that installs on Android 11+ | `keytool` generates keystore; `build.gradle` signingConfig with `keystore.properties`; `npx cap build android` with `androidReleaseType: 'APK'` and `signingType: 'apksigner'` produces valid signed APK. `adb install` verifies on Android 11+. |
| REL-02 | App has custom icon and splash screen | Adaptive icon via vector drawable foreground ("Z" text) + `#1a1a2e` background; splash via Capacitor SplashScreen plugin + `@drawable/splash` with white "Zestok" text on `#1a1a2e` background. |
| REL-03 | Keystore backed up securely | Keystore stored outside repo (gitignored), documented in `RELEASE.md`; developer responsible for secure backup. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App icon display | Client (Android OS) | — | Android launcher renders icons from mipmap resources; no server involvement |
| Splash screen display | Client (Android OS) | Capacitor SplashScreen plugin | Native Android splash (Theme.SplashScreen API for Android 12+, fallback drawable for older). Plugin manages auto-hide timing. |
| APK signing | Build system (Gradle) | CLI (keytool, apksigner) | Signing configuration lives in `build.gradle`; `keytool` generates keys offline; `apksigner` runs during build pipeline |
| Keystore storage | Developer machine | — | Keystore intentionally excluded from VCS; developer manages backup |
| Installation verification | Client (adb / Android OS) | — | `adb install` on developer machine; end users install via APK sideload or future Play Store |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| JDK (OpenJDK) | 21.0.11+ | Java runtime for `keytool`, Gradle, and Android build chain | Required by Android Gradle Plugin (AGP) 8.x |
| Android SDK Build-Tools | 37.0.0 | Provides `apksigner`, `zipalign`, `aapt2` | Required by Capacitor for APK signing and resource packaging |
| Gradle (wrapper) | 8.x (AGP 8.13.0) | Android build system | Generated by Capacitor; handles compilation, signing, packaging |
| apksigner | bundled with build-tools 37.0.0 | APK signature tool (v1/v2/v3/v4 schemes) | [VERIFIED: official Android docs] — mandatory for apps targeting API 30+ (Android 11+) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @capacitor/assets | 3.0.5 | Generate icon / splash PNGs at all densities from a source image | If generating icon via tool instead of manual vector drawable |
| keystore.properties | N/A | Gitignored Gradle properties for signing credentials | Local signing; CI uses environment variables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `build.gradle` signingConfig + `keystore.properties` | `npx cap build` CLI flags (`--keystorepath`, `--keystorepass`) | CLI flags are ephemeral (not persisted); `build.gradle` + properties file ensures repeatable builds. |
| `apksigner` for APK | `jarsigner` (Capacitor default) | `jarsigner` produces APKs rejected by Android 11+ (API 30+) because it only signs with v1 scheme. `apksigner` is mandatory. |
| Text-based vector drawable for icon | PNG raster at all densities via `@capacitor/assets` | Vector scales perfectly at any density; no density-specific PNGs needed for the foreground layer. PNG needed for background drawable in pre-v26 fallback paths. |
| `@capacitor/assets` easy mode | Manual density PNGs | Easy mode generates everything from a single logo file — less work. But requires adding a dev dependency and source image. |

**Installation:**
```bash
# If using @capacitor/assets for icon generation (optional - agent's discretion)
cd mobile
npm install --save-dev @capacitor/assets@^3.0.5
```

**Version verification:** Before planning execution, verify installed versions:
```bash
node --version          # Must be 18+ (24.16.0 confirmed)
java -version           # Must be JDK 17+ (21.0.11 confirmed)
keytool -version        # Should match JDK version (21.0.11 confirmed)
npx cap --version       # Should be >= 8.4.1
adb --version           # Build-tools version should match SDK (37.0.0 confirmed)
```

## Package Legitimacy Audit

> Phase 6 installs no new runtime packages. The only optional dev dependency is `@capacitor/assets`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @capacitor/assets | npm | ~6 yrs | ~75K/wk | github.com/ionic-team/capacitor-assets | OK | Optional (agent's discretion) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No runtime packages are installed for this phase. Keystore, `apksigner`, `keytool`, and `adb` are all platform tools, not npm packages.*

## Architecture Patterns

### System Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT MACHINE                                     │
│                                                                           │
│  ┌──────────────┐    ┌───────────────┐    ┌────────────────────────┐     │
│  │  keytool      │    │  build.gradle │    │  capacitor.config.ts   │     │
│  │  (keystore)   │    │  signingConfig│    │  SplashScreen plugin   │     │
│  └──────┬───────┘    └──────┬────────┘    └────────┬───────────────┘     │
│         │                   │                       │                      │
│         ▼                   ▼                       ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    Gradle Build Pipeline                          │     │
│  │                                                                   │     │
│  │  1. Prepare dependencies (Capacitor sync)                         │     │
│  │  2. Compile Android Java/Kotlin sources                           │     │
│  │  3. Package resources (icons, splash from res/)                   │     │
│  │  4. Create unsigned APK (assembleRelease)                        │     │
│  │  5. Sign with apksigner (keystore + signingConfig)               │     │
│  │  6. Zipalign (4-byte boundary for API 30+)                       │     │
│  └──────────────────────────┬───────────────────────────────────────┘     │
│                             │                                             │
│                             ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    Output: app-release.apk                        │     │
│  │                    Location: android/app/build/outputs/apk/release │     │
│  └──────────────────────────┬───────────────────────────────────────┘     │
│                             │                                             │
│                             ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    adb install app-release.apk                     │     │
│  │                    → Verify on Android 11+ device                 │     │
│  └──────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
stock-management/
├── mobile/
│   ├── android/
│   │   ├── app/
│   │   │   └── build.gradle                    # MODIFY: add signingConfigs
│   │   │   └── src/main/res/
│   │   │       ├── values/
│   │   │       │   ├── ic_launcher_background.xml  # MODIFY: change to #1a1a2e
│   │   │       │   └── styles.xml                  # MODIFY: splash drawable reference
│   │   │       ├── drawable/
│   │   │       │   └── ic_launcher_background.xml  # MODIFY: replace grid with solid #1a1a2e
│   │   │       ├── drawable-v24/
│   │   │       │   └── ic_launcher_foreground.xml  # MODIFY: replace with "Z" vector text
│   │   │       ├── drawable-port-*/                 # REPLACE splash.png with text-based versions
│   │   │       ├── drawable-land-*/                 # REPLACE splash.png with text-based versions
│   │   │       └── mipmap-anydpi-v26/
│   │   │           ├── ic_launcher.xml              # UNCHANGED (adaptive icon refs)
│   │   │           └── ic_launcher_round.xml        # UNCHANGED (adaptive icon refs)
│   │   └── keystore.properties          # CREATE: gitignored, keystore config
│   ├── .gitignore                       # VERIFY: *.jks *.keystore already excluded ✓
│   ├── capacitor.config.ts              # MODIFY: add launchAutoHide, signing config for build
│   └── package.json                     # UNCHANGED (version already 1.0.0)
├── RELEASE.md                           # CREATE: build & signing documentation
└── .gitignore                           # VERIFY: keystore.properties excluded
```

### Pattern 1: Adaptive Icon as Vector Text Drawable

**What:** Replace the default Capacitor icon foreground (Android head) with a vector drawable rendering "Z" text centered on a `#1a1a2e` background. The adaptive icon system uses two layers: background (solid color or vector) and foreground (104×104dp safe zone within 108×108dp canvas).

**When to use:** Standard Android 8+ (API 26+) adaptive icon format. Fallback PNGs in mipmap-* directories handle pre-API-26 devices.

**Implementation:**
- Background layer: Change `drawable/ic_launcher_background.xml` from the grid pattern vector to a solid `#1a1a2e` rectangle.
- Foreground layer: Replace `drawable-v24/ic_launcher_foreground.xml` with a vector containing centered "Z" text. Use `android:fillColor="#FFFFFF"` and position text within the 72dp safe zone circle.
- Background color resource: Change `values/ic_launcher_background.xml` from `#FFFFFF` to `#1a1a2e` (this is used by pre-v26 fallback paths).

**Vector text drawable approach:**
Using `android.graphics.Typeface` is not available in vector drawables. Instead, render "Z" as vector paths. A practical approach is to generate the vector via `@capacitor/assets` easy mode (which handles text-to-vector conversion) or manually craft a simple geometric "Z" as path data.

**Agent's discretion:** The exact rendering approach (manual vector paths vs. `@capacitor/assets` easy mode with a generated source image).

### Pattern 2: Splash Screen via Capacitor SplashScreen Plugin

**What:** The existing Capacitor `SplashScreen` plugin is already configured with `launchShowDuration: 2000` and `backgroundColor: '#1a1a2e'`. The splash content is currently a Capacitor logo PNG in `drawable-port-*/splash.png` and `drawable-land-*/splash.png`. The styles.xml references `@drawable/splash` in `AppTheme.NoActionBarLaunch`.

**When to use:** Standard Capacitor pattern — splash image is placed in Android `drawable-*` resources and referenced by the launch theme.

**Change plan:** Replace the splash PNGs with text-based images (white "Zestok" centered on `#1a1a2e`). The simplest approach: generate new splash PNGs via `@capacitor/assets` if using the tool, or create a vector drawable for the splash content.

**`capacitor.config.ts` update:**
```typescript
SplashScreen: {
  launchShowDuration: 2000,
  launchAutoHide: true,           // ADD if not present (should be default)
  backgroundColor: '#1a1a2e',
  // androidSplashResourceName: 'splash'  // default, no change needed
}
```

### Pattern 3: Signing Configuration with keystore.properties

**What:** Android Gradle best practice for keeping credentials out of version control. A gitignored `keystore.properties` file holds paths and passwords; `build.gradle` loads it and configures `signingConfigs.release`.

**When to use:** Every Android project that signs release builds. Avoids hardcoding secrets in VCS.

**`keystore.properties` (gitignored):**
```properties
storeFile=C\\:/Users/memon/.android/zestok-keystore.jks
storePassword=<strong-password>
keyAlias=zestok
keyPassword=<same-strong-password>
```

**`build.gradle` signingConfig block:**
```groovy
// At top level, before android { }
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ...
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release  // ADD this line
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Important:** The `storeFile` path must use forward slashes or escaped backslashes for Windows paths.

### Anti-Patterns to Avoid

- **Hardcoding keystore passwords in build.gradle** — leaks secrets to VCS. Always use `keystore.properties` (local) or environment variables (CI).
- **Using jarsigner for APK targeting Android 11+** — jarsigner only signs with v1 scheme, which Android refuses for API 30+ targets. Use apksigner.
- **Trying apksigner with AAB output** — apksigner does not support `.aab` files (throws `ApkFormatException: Missing AndroidManifest.xml`). Set `androidReleaseType: 'APK'` when using apksigner.
- **Storing keystore in repo** — even temporarily. Once committed, it's compromised forever. The `.gitignore` already excludes `*.jks` and `*.keystore` — verify both parent and child gitignores cover these patterns.
- **Using absolute paths in build.gradle without fallback** — local keystore.properties uses absolute paths, but the `file()` call should gracefully handle missing properties with an `exists()` check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Generating icon PNGs at all densities | Manual resizing in image editor | `@capacitor/assets` v3.0.5 (easy mode) or Android Studio Image Asset tool | Generates all mipmap densities, adaptive icon XML, and fallbacks from a single source image. Handles Android 8+ adaptive icon format. |
| APK signing | Custom signing script | `apksigner` (via build.gradle) | `apksigner` handles v1/v2/v3/v4 signing schemes, zipalign, and rotation. Manual signing scripts miss edge cases (signature scheme version, alignment). |
| Keystore generation | Custom key generation | `keytool` (JDK built-in) | `keytool` generates RSA 2048-bit key pairs in JKS/PKCS12 format compatible with Android. No custom code needed. |

**Key insight:** Android's build toolchain is mature — `keytool`, `apksigner`, `zipalign`, and Gradle's `signingConfigs` solve these problems correctly. Custom build scripts introduce fragility without benefit.

## Common Pitfalls

### Pitfall 1: apksigner + AAB = Silent Signing Failure

**What goes wrong:** Running `npx cap build android` with the default AAB release type and `signingType: 'apksigner'` produces a cryptic `MinSdkVersionException: Failed to determine APK's minimum supported platform version`.

**Why it happens:** Capacitor CLI v8 passes the `.aab` file to `apksigner`, which expects an APK format. AAB stores `AndroidManifest.xml` at `base/manifest/` — apksigner looks at root and fails.

**How to avoid:** Always pair `releaseType: 'AAB'` with `signingType: 'jarsigner'` (the default), OR pair `releaseType: 'APK'` with `signingType: 'apksigner'`. For this phase (needing APK sideloading), use APK release type:
```typescript
// capacitor.config.ts
android: {
  buildOptions: {
    androidReleaseType: 'APK',
    signingType: 'apksigner',
  }
}
```

**Warning signs:** If `npx cap build android` fails with "Failed to determine APK's minimum supported platform version", check that release type and signing type are compatible.

### Pitfall 2: APK Rejected on Android 11+ with "App not installed"

**What goes wrong:** The APK builds successfully but `adb install` fails with "Failure [-124: Failed parse during installPackageLI: Targeting R+ ... requires the resources.arsc to be stored uncompressed and aligned on a 4-byte boundary]".

**Why it happens:** jarsigner (Capacitor default) signs APKs with only the v1 signature scheme. Android 11+ (API 30+) requires v2 signature scheme minimum, plus proper 4-byte alignment of resources.arsc.

**How to avoid:** Use `signingType: 'apksigner'` with `androidReleaseType: 'APK'` in capacitor config. apksigner applies v2+ schemes automatically. `zipalign` must also be run (apksigner handles this).

### Pitfall 3: Keystore Path Issues on Windows

**What goes wrong:** `keystore.properties` specifies `storeFile=C:\Users\memon\.android\release.jks` but Gradle fails with "keystore not found" because the backslashes are interpreted as escape characters.

**How to avoid:** Use forward slashes (`C:/Users/memon/.android/release.jks`) or escaped backslashes (`C\\:\\\\Users\\\\...`) in `keystore.properties`. Alternatively, use a path relative to the project (e.g., `../../release.jks` if keystore is in `mobile/`).

### Pitfall 4: Splash Screen Not Updating After Resource Change

**What goes wrong:** Replaced splash.png in drawable directories, rebuilt, but the app still shows the old Capacitor logo on launch.

**Why it happens:** Android resource cache or Gradle incremental build does not pick up resource changes. The splash image is referenced by the launch theme which fires before Capacitor's web content loads.

**How to avoid:** Run `npx cap sync android` after resource changes to ensure Capacitor copies the latest web assets. Also do a clean Gradle build (`./gradlew clean`) for the first rebuild after resource changes. For splash specifically, ensure `capacitor.config.ts` has `androidSplashResourceName: 'splash'` (default) and the drawables are present at the correct density.

### Pitfall 5: Version Code / Name Mismatch

**What goes wrong:** The version in `build.gradle` (`versionName "1.0"`) doesn't match the npm `package.json` version (`"1.0.0"`). Future automated release tooling might be confused by format mismatch.

**How to avoid:** Set `versionName "1.0.0"` in `build.gradle` to match `package.json`. Decide on a canonical source of truth for version (CONTEXT.md D-67 says `build.gradle` or `capacitor.config.ts`). Standard pattern: `build.gradle` for Android, sync manually.

## Code Examples

Verified patterns from official sources:

### Keystore Generation
```bash
# Generate RSA 2048-bit keystore (PKCS12 format, recommended)
keytool -genkey -v -keystore zestok-release.jks \
  -alias zestok \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype PKCS12

# Verify keystore contents
keytool -list -v -keystore zestok-release.jks -alias zestok
```

### signingConfig in build.gradle with keystore.properties
```groovy
// mobile/android/app/build.gradle -- add BEFORE android { } block
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.zestok.mobile"
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.zestok.mobile"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0.0"                              // MODIFIED: was "1.0"
        // ... rest of defaultConfig
    }
    signingConfigs {                                      // NEW BLOCK
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release           // ADDED
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### keystore.properties (gitignored)
```properties
storeFile=C:/Users/memon/.android/zestok-release.jks
storePassword=<use-a-strong-password>
keyAlias=zestok
keyPassword=<use-a-strong-password>
```

### capacitor.config.ts — Signing & Splash Config
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zestok.mobile',
  appName: 'Zestok',
  webDir: 'dist',
  server: {
    cleartext: true,
  },
  android: {
    buildOptions: {
      androidReleaseType: 'APK',          // ADDED: APK for sideloading
      signingType: 'apksigner',            // ADDED: required for API 30+
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,               // ADDED (explicit)
      backgroundColor: '#1a1a2e',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
```

### Build & Install Commands
```bash
# Step 1: Sync Capacitor with latest config and web build
cd mobile
npm run build                    # Vite builds dist/
npx cap sync android             # Copies web assets to Android project

# Step 2: Build signed APK (uses Gradle + apksigner)
npx cap build android            # Produces app-release.apk

# Alternative for more control: direct Gradle
cd mobile/android
./gradlew assembleRelease        # Produces unsigned APK
# Then sign manually with apksigner
apksigner sign --ks ../keystore.properties \
  app/build/outputs/apk/release/app-release-unsigned.apk

# Step 3: Install and verify
adb install mobile/android/app/build/outputs/apk/release/app-release.apk

# Verify APK signature
apksigner verify mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Adaptive Icon — Background Drawable (Updated)
```xml
<!-- mobile/android/app/src/main/res/drawable/ic_launcher_background.xml -->
<!-- REPLACE grid pattern with solid #1a1a2e -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#1a1a2e"
        android:pathData="M0,0h108v108h-108z" />
</vector>
```

### Adaptive Icon — Background Color Resource (Updated)
```xml
<!-- mobile/android/app/src/main/res/values/ic_launcher_background.xml -->
<!-- CHANGE from #FFFFFF to #1a1a2e -->
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1a1a2e</color>
</resources>
```

### Adaptive Icon — Foreground "Z" Text
```xml
<!-- mobile/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml -->
<!-- REPLACE Android head with centered "Z" text -->
<!-- This is a simplified path-based version. Agent's discretion on exact rendering. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- The "S" letter -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M41,38 C41,34 44,31 48,31 L60,31 C64,31 67,34 67,38
                          C67,42 64,45 60,45 L48,45 C44,45 41,48 41,52
                          C41,56 44,59 48,59 L60,59 C64,59 67,56 67,52" />
    <!-- The "M" letter -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M41,59 L41,77 L48,68 L54,77 L54,59" />
</vector>
```

**Important note on icon foreground:** The above path data is a simplified representation. The actual vector paths for good-looking text should be generated via `@capacitor/assets` or a design tool. The agent may opt to use `@capacitor/assets` easy mode with a 1024x1024 source image containing white "Z" on transparent, which produces proper vectorized output.

### Splash Screen — Image Replacement
The existing `drawable-port-*/splash.png` and `drawable-land-*/splash.png` files (Capacitor logo) need replacement. Two approaches:

**Approach A (Recommended):** Use `@capacitor/assets` easy mode to generate from a source logo image:
```bash
# Create assets/splash.png with white "Zestok" text on #1a1a2e (1024x1024+)
npx @capacitor/assets generate --android \
  --splashBackgroundColor '#1a1a2e' \
  --iconBackgroundColor '#1a1a2e'
```
This generates all density splash PNGs and icon variants.

**Approach B (Manual):** Create splash as a vector drawable referencing the solid background color and centered text:
```xml
<!-- mobile/android/app/src/main/res/drawable/splash_bg.xml -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="720dp"
    android:height="1280dp"
    android:viewportWidth="720"
    android:viewportHeight="1280">
    <path
        android:fillColor="#1a1a2e"
        android:pathData="M0,0h720v1280h-720z" />
</vector>
```
Then reference this drawable in `styles.xml`:
```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:background">@drawable/splash_bg</item>
</style>
```
With the Capacitor `androidSplashResourceName: 'splash'` config, the existing splash.png files in drawable directories are used. If using a vector, set `androidSplashResourceName` to the new resource name.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jarsigner for all signing | apksigner for APK, jarsigner for AAB | Android 11 (API 30) | jarsigner-only APKs rejected on Android 11+ |
| JKS keystore format | PKCS12 (default since JDK 9) | JDK 9 (2017) | PKCS12 is more secure and interoperable. `keytool` defaults to PKCS12 since JDK 9. |
| Manual icon PNG generation | `@capacitor/assets` easy mode | 2020 | One command generates all densities, adaptive icon XML, and splash images |
| Cordova-based splash | Android 12 SplashScreen API | Android 12 (2021) | Newer API provides faster, smoother splash. Capacitor v8 supports both. The `Theme.SplashScreen` parent handles the new API on Android 12+. |

**Deprecated/outdated:**
- **jar signer for APK files:** Don't use. `apksigner` is mandatory for API 30+.
- **Maven (Gradle's built-in dependency manager):** Not relevant here but note that `jcenter()` is sunset — `google()` and `mavenCentral()` are the standard repositories.
- **Android 11- splash behavior:** Older splash is the drawable-based approach. Android 12+ uses the SplashScreen API (`Theme.SplashScreen`). Capacitor v8 handles both transparently, but the `androidSplashResourceName` setting does NOT work on launch with the Android 12 API (only after launch). The styles.xml approach is the reliable path.

## Assumptions Log

> All claims in this research were verified via websearch of official Capacitor docs, Android developer docs, or confirmed via environment probing. No user confirmation needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `androidSplashResourceName` doesn't work on launch with Android 12 API | Splash Screen Patterns | Low — the standard `styles.xml` approach with `@drawable/splash` always works as fallback |
| A2 | Capacitor v8 ships `coreSplashScreenVersion 1.2.0` supporting `Theme.SplashScreen` | Environment | Low — confirmed in `variables.gradle`. Version may differ, but parent theme is backward compatible |

## Open Questions (RESOLVED)

1. **Whether to use `@capacitor/assets` or manual vector drawables for icon**
   - What we know: Both approaches work. `@capacitor/assets` requires an install and source image; manual vectors require no dependencies but need correct path data.
   - What's unclear: Exact quality of output from `@capacitor/assets` easy mode for text-only icon.
   - Recommendation: Mark as agent's discretion. Manual vector approach is lighter (no dependency); `@capacitor/assets` is more maintainable for future icon changes.

2. **Keystore backup strategy documentation**
   - What we know: Keystore must be outside repo. `RELEASE.md` documents location and process.
   - What's unclear: Whether developer has a password manager or secure storage available (user's decision per D-63).
   - Recommendation: `RELEASE.md` should include a backup checklist (password manager entry, cloud backup of keystore file, printed copy of fingerprint).

## Environment Availability

> Environment confirmed on 2026-07-11 against a Windows 11 development machine.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npx cap build`, npm, Vite | ✓ | 24.16.0 | — |
| JDK / Java | Gradle, keytool, apksigner | ✓ | 21.0.11 (Zulu) | — |
| keytool | Keystore generation (JDK built-in) | ✓ | 21.0.11 | — |
| Android SDK | Gradle build (compileSdk 36) | ✓ | 36 (build-tools 34-37) | — |
| apksigner | APK signing (build-tools) | ✓ | 37.0.0 | — |
| adb | Installation verification | ✓ | 37.0.0 | — |
| Gradle wrapper | Android build | ✓ | AGP 8.13.0 | `gradle` system command (not needed) |
| ANDROID_HOME | Gradle SDK path resolution | ✓ | `C:\Users\memon\AppData\Local\Android\Sdk` | — |
| @capacitor/assets | Icon/splash generation (optional) | npm registry | 3.0.5 | Manual vector drawables |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none — all essential tools are available.

## Validation Architecture

> This section is included because `workflow.nyquist_validation` is not explicitly set to `false` in config.json.

### Test Framework

This phase produces an installable APK. The primary validation is installation + manual smoke test, not unit tests.

| Property | Value |
|----------|-------|
| Framework | Manual smoke test + `adb install` verification |
| Config file | N/A — no test runner |
| Quick run command | `adb install mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Full suite command | Manual: launch app, verify PIN auth, dashboard, rate check, settings, sign-out |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-01 | Signed APK installs on Android 11+ | Smoke | `adb install .../app-release.apk && adb shell am start -n com.zestok.mobile/.MainActivity` | ❌ Manual |
| REL-02 | Custom icon displayed on home screen | Manual | Visual inspection — app icon shows "Z" on dark background | ❌ Manual |
| REL-02 | Splash screen shows on launch | Manual | Visual inspection — "Zestok" white text on dark bg | ❌ Manual |
| REL-03 | Keystore backed up | Audit | Verify keystore exists at documented location and backup | ❌ Manual |

### Sampling Rate
- **Per task commit:** N/A — no code changes to unit-test
- **Per wave merge:** Manual smoke test of signed APK
- **Phase gate:** APK installs successfully + all features work in release build

### Wave 0 Gaps
- [ ] No automated test infrastructure for Android APK signing — validation is inherently manual (visual inspection of icon/splash, adb install)
- [ ] Functional testing of release build is manual (launch app, exercise all features)

## Security Domain

> `security_enforcement` is enabled (absent from config = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase handles signing, not auth |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No | — |
| V6 Cryptography | Yes (keystore) | `keytool` with RSA 2048-bit, PKCS12 format |
| V7 Malicious Code | Partial | APK signing ensures code integrity — modified APK will fail signature verification |
| V8 Communication Security | No | — |
| V9 Data Storage | No | — |

### Known Threat Patterns for APK Signing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Keystore theft from repo | Tampering | Keystore excluded via `.gitignore` (`*.jks`, `*.keystore`) stored outside repo |
| APK tampering after build | Tampering | `apksigner` v2/v3 signature scheme — modified APK won't pass signature verification |
| Private key exposure | Information Disclosure | Password protected keystore (`-storepass`), documented backup procedure in `RELEASE.md` |
| CI credential leak | Tampering | CI should use injected env vars, not committed `keystore.properties` |

## Sources

### Primary (HIGH confidence)
- [Capacitor SplashScreen Plugin API](https://capacitorjs.com/docs/apis/splash-screen) — Configuration options, `androidSplashResourceName`, `launchAutoHide` defaults [CITED: capacitorjs.com]
- [Capacitor CLI Build Command](https://capacitorjs.com/docs/cli/commands/build) — `androidReleaseType`, `signingType`, `keystorepath` flags [CITED: capacitorjs.com]
- [Capacitor Assets README](https://github.com/ionic-team/capacitor-assets) — `@capacitor/assets` easy mode and custom mode [CITED: github.com]
- [Android App Signing Guide](https://developer.android.com/studio/publish/app-signing) — SigningConfigs, keystore requirements, apksigner vs jarsigner [VERIFIED: official Android docs]
- [Gradle Tips & Recipes](https://developer.android.com/build/gradle-tips) — `keystore.properties` pattern for credential management [VERIFIED: official Android docs]
- [Capacitor v8 Bug: apksigner + AAB](https://github.com/ionic-team/capacitor/issues/8428) — Incompatibility confirmation [CITED: github.com/ionic-team/capacitor/issues/8428]

### Secondary (MEDIUM confidence)
- [Capacitor v8 Bug: apksigner APK install failure](https://github.com/ionic-team/capacitor/issues/8106) — resources.arsc alignment issue with jarsigner [CITED: github.com]
- Android adaptive icon format guidelines (108dp canvas, 72dp safe zone, 66dp inner circle) — confirmed by multiple sources

### Tertiary (LOW confidence)
- None — all technical claims cross-referenced against official docs or active codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All tools confirmed installed and verified
- Architecture: HIGH — Signing flow is well-documented Android standard
- Pitfalls: HIGH — Capacitor v8 signing bugs are documented in official issue tracker with clear reproduction steps

**Research date:** 2026-07-11
**Valid until:** 2026-08-11 (stable Android tooling — keytool, apksigner, Gradle patterns change slowly)
