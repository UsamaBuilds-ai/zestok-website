# Stock Management Mobile — Release Build Process

## Prerequisites

- Node.js 18+ (24.16.0 confirmed)
- JDK 17+ (21.0.11 confirmed)
- Android SDK 36 (build-tools 37.0.0)
- ANDROID_HOME environment variable (`C:\Users\memon\AppData\Local\Android\Sdk`)
- Android device or emulator running Android 11+ (API 30+)

## Environment Verification

```bash
java -version
node --version
npx cap --version
echo %ANDROID_HOME%
```

## Keystore

- **Location:** `%USERPROFILE%\.android\stock-mgmt-release.jks` (OUTSIDE the repository)
- **Alias:** `stock-mgmt`
- **Algorithm:** RSA 2048-bit, PKCS12 format
- **Validity:** 10000 days (~27 years)
- **Generated:** 2026-07-12
- **SHA1 Fingerprint:** `1A:F9:B5:CF:BD:F3:4B:6F:54:19:02:3B:DA:43:D9:ED:57:0D:4C:0D`

### ⚠️ Keystore Backup Checklist (REL-03)

- [ ] Copy keystore file to secure backup location (USB drive / cloud storage)
- [ ] Store passwords in password manager (Bitwarden/1Password/KeePass)
- [ ] Verify backup: `keytool -list -v -keystore <backup-path> -alias stock-mgmt`
- [ ] Print keystore fingerprint and store in safe location

## Signing Configuration

- `mobile/android/keystore.properties` — gitignored, contains local keystore paths
- `mobile/android/app/build.gradle` — `signingConfigs.release` reads from properties
- `mobile/capacitor.config.ts` — `androidReleaseType: 'APK'`, `signingType: 'apksigner'`

## Build Steps

### Full Build with Gradle (recommended)

```bash
cd mobile
npm run build                    # Vite builds web assets to dist/
npx cap sync android             # Copies web assets to Android project
cd android
./gradlew assembleRelease        # Builds unsigned APK
```

### Sign the APK

```bash
set ANDROID_HOME=C:\Users\memon\AppData\Local\Android\Sdk
"%ANDROID_HOME%\build-tools\37.0.0\apksigner" sign ^
  --ks "%USERPROFILE%\.android\stock-mgmt-release.jks" ^
  --ks-pass pass:<keystore-password> ^
  --ks-key-alias stock-mgmt ^
  --key-pass pass:<key-password> ^
  --out app/build/outputs/apk/release/app-release.apk ^
  app/build/outputs/apk/release/app-release.apk
```

### Verify Signature

```bash
"%ANDROID_HOME%\build-tools\37.0.0\apksigner" verify --verbose ^
  app/build/outputs/apk/release/app-release.apk
```

Expected output: `Verified using v2 scheme: true` and `Verified using v3 scheme: true`

## Output

- **APK:** `mobile/android/app/build/outputs/apk/release/app-release.apk`

## Installation

```bash
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.stockmgmt.mobile/.MainActivity
```

## Versioning

- **Current version:** 1.0.0 (semantic versioning per D-67)
- **Version code:** 1 (increment per release)
- **Version defined in:** `mobile/android/app/build.gradle` > `defaultConfig` > `versionName`

## Verification Checklist

- [ ] APK signature verified with apksigner (v2 + v3 schemes present)
- [ ] APK installs on Android 11+ device
- [ ] PIN authentication works
- [ ] Dashboard shows with metrics and stock table
- [ ] Rate check screen works with autocomplete
- [ ] Bottom navigation and settings accessible
- [ ] Splash screen shows "Stock Management" on dark background
- [ ] App icon shows "SM" branded icon on home screen

## Troubleshooting

### APK install fails on Android 11+ ("App not installed")

Ensure signing uses apksigner (not jarsigner). Check `signingType: 'apksigner'` in capacitor.config.ts. jarsigner only signs with v1 scheme, which Android 11+ rejects. Verify with `apksigner verify --verbose`.

### "Failed to determine APK's minimum supported platform version"

Incompatible release type and signing type combination. Ensure `androidReleaseType: 'APK'` when using `signingType: 'apksigner'`. AAB + apksigner is not supported by Capacitor v8.

### Keystore path error in Gradle

Use forward slashes in keystore.properties path: `storeFile=C\:/Users/memon/.android/stock-mgmt-release.jks`

### apksigner not found

`apksigner` is bundled with Android SDK Build-Tools. Ensure `%ANDROID_HOME%\build-tools\<version>\` is on your PATH, or use the full path:

```bash
"%ANDROID_HOME%\build-tools\37.0.0\apksigner"
```
