# Domain Pitfalls: Capacitor/Android

**Domain:** Capacitor v8 Android mobile app
**Researched:** 2026-07-07
**Overall confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites, permanent data loss, or completely block deployment.

### Pitfall 1: Keystore Loss / Mismanagement

**What goes wrong:** The developer loses the keystore file (.jks/.keystore), forgets the keystore password, or stores it in the git repo unprotected. Once an app is published to the Play Store (or sideloaded with a known signature), a different keystore produces a different signature — Android treats it as a different app. Updates become impossible without the original keystore.

**Why it happens:** First-time developers don't realise the keystore is irreplaceable. They generate it in a random directory, never back it up, and hardcode passwords into `build.gradle` (which then gets committed to git, leaking credentials).

**Consequences:**
- Published app can never be updated — must unpublish and re-release as new app
- Users lose all local data tied to the previous app's signature
- Password leak exposes signing key for impersonation attacks

**Prevention:**
1. Generate keystore using `keytool -genkey -v -keystore stock-management-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias stock-key`
2. Store the .jks file in a secure, backed-up location (not in the repo)
3. Use a password manager for keystore/key passwords
4. Never hardcode passwords in `build.gradle` — use environment variables or a `.keystore.properties` file that is `.gitignore`d
5. For this project (sideloaded APK, no Play Store), backups are still critical — losing the keystore means users must uninstall the old app before installing a new build

**Detection:** Missing keystore = app reinstall required on every update. Warning signs: "App not installed" error on update.

**Phase mapping:** Phase that handles APK build/release must include keystore creation and safe storage as a gated step.

---

### Pitfall 2: jarsigner vs apksigner — Wrong Signing Tool for APK

**What goes wrong:** By default, `npx cap build android` uses `jarsigner` for signing. When producing an APK (not AAB), `jarsigner` creates a V1 signature that is **rejected by Android 11+ (API 30+)** . The APK installs on older devices, fails on modern ones with "App not installed as package appears to be invalid."

**Why it happens:** Capacitor's default `signingType` is `'jarsigner'` because that works for AAB files. The CLI does not auto-select `apksigner` for APK builds despite APK being the output format this project needs (sideloading). Users don't read release notes about Android 11+ signature requirements.

**Consequences:**
- APK builds that pass locally fail on any Android 11+ device
- Developer spends hours debugging thinking it's a device issue
- Must rebuild with correct signing type

**Prevention:**
1. In `capacitor.config.ts`, explicitly set:
```ts
android: {
  buildOptions: {
    androidReleaseType: 'APK',
    signingType: 'apksigner'
  }
}
```
2. Or pass CLI flags: `--signing-type apksigner --androidreleasetype APK`
3. Note: `apksigner` requires `pass:` prefix for passwords — `--keystorealiaspass pass:yourpassword`
4. Never use `apksigner` with AAB files — it silently fails with confusing "Missing AndroidManifest.xml" errors
5. Test install on an Android 11+ device before considering signing done

**Detection:** Run `adb install app-release-signed.apk` — if it fails with `FAILED_PARSE` or `INSTALL_FAILED_NO_MATCHING_ABIS` on Android 11+, this is the likely cause.

**Phase mapping:** APK signing phase must include signingType configuration and test-install verification.

---

### Pitfall 3: Cleartext HTTP Traffic Blocked — API Calls Fail Silently

**What goes wrong:** The app makes API calls to `http://84.235.249.239:3000` (the existing backend, which uses plain HTTP). On Android 9+ (API 28+), cleartext HTTP traffic is blocked by default. The app's API calls fail with `ERR_CLEARTEXT_NOT_PERMITTED` in the WebView — but JS fetch() just shows a generic network error with no clear message.

**Why it happens:**
- Android 9+ blocks HTTP by default for security
- Capacitor `androidScheme` defaults to `'https'` since Capacitor 6 — the WebView loads the app at `https://localhost`, and mixed-content rules prevent HTTP requests from an HTTPS origin
- Developers assume "it works in the browser" = "it works on device"
- The error can masquerade as CORS errors in Chrome DevTools inspection

**Consequences:**
- App launches but shows zero data — looks broken
- PIN auth fails silently — user can't log in
- Developer chases wrong cause (CORS, network config, firewall)

**Prevention (double-layered approach — both required):**

1. **Capacitor config** — in `capacitor.config.ts`:
```ts
server: {
  androidScheme: 'http',  // Must be 'http', not 'https'
  cleartext: true,
  allowNavigation: ['84.235.249.239']
}
```

2. **Android manifest** — create `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">84.235.249.239</domain>
  </domain-config>
</network-security-config>
```

3. Reference it in `AndroidManifest.xml`:
```xml
<application
  android:usesCleartextTraffic="true"
  android:networkSecurityConfig="@xml/network_security_config"
  ...>
```

4. **Critical**: After changing capacitor config, run `npx cap sync android` (not just `npx cap copy`) to propagate changes to native Android configs

**Detection:** Connect Chrome DevTools to the running app via `chrome://inspect` — the console shows `ERR_CLEARTEXT_NOT_PERMITTED` or `Mixed Content` errors. If API calls work in the browser but not on-device, this is the cause.

**Phase mapping:** Must be addressed in the API connectivity phase before any real API calls are tested. Include in the "first on-device test" checklist.

---

### Pitfall 4: Live Reload Destroys Server Config

**What goes wrong:** Running `npx cap run android -l` (live reload) destructively replaces `capacitor.config.json`'s `server` object with only `{ url: 'http://host:port' }`. All other config — `androidScheme`, `cleartext`, `allowNavigation` — gets wiped. Subsequent API calls fail even though live reload works.

**Why it happens:** Capacitor's `editCapConfigForLiveReload` function uses `configJson.server = { url }` instead of merging with existing config. This is a known open bug (several PRs submitted, not fully resolved as of mid-2026).

**Consequences:**
- After using live reload, builds no longer connect to API
- Developer must re-run `npx cap sync` to restore config
- Intermittent "works sometimes" behaviour erodes confidence

**Prevention:**
1. Avoid live reload during API integration testing — use full builds instead
2. If using live reload, re-run `npx cap sync android` after stopping live reload to restore config
3. Build API config directly into the app's JS (hardcoded or env-based), not relying solely on `capacitor.config.ts` server fields
4. For this project: set the API base URL in the web app code (configurable via env), not in native config

**Detection:** After running live reload, check `android/app/src/main/assets/capacitor.config.json` — if `server` only contains `url`, config was stripped.

**Phase mapping:** If a live-reload development workflow is planned, add a note to the dev setup phase about this bug.

---

### Pitfall 5: Plugin Version Mismatch After Capacitor Upgrade

**What goes wrong:** After adding Capacitor Android (v8 is already in package.json), some plugins may be on older versions. During a signed release build, R8/proguard minification fails with "Missing classes detected" errors referring to `com.getcapacitor.JSArray`, `com.getcapacitor.Plugin`, etc. The error trace points to plugin `.jar` files, not your code.

**Why it happens:** Outdated plugin versions register for Capacitor classes during build that don't exist in the current Capacitor version. R8 stripping removes Capacitor core classes, but plugin code still references them. The official plugin update wasn't synced.

**Consequences:**
- Debug builds work fine (R8 is off) but release/signed builds fail
- Hard to diagnose — the error points to Java/smali, not your code
- Wastes hours before discovering "run `npm outdated`"

**Prevention:**
1. Before any signed build, run `npm outdated` and update all `@capacitor/*` packages
2. Run `npm audit fix` to resolve safe updates
3. Run `npx cap sync android` after updating
4. Do a signed build early (even a dummy one) to catch version mismatches before they block the final release
5. Pin all Capacitor packages to the same major version:
```json
"@capacitor/android": "^8.0.0",
"@capacitor/core": "^8.0.0",
"@capacitor/cli": "^8.0.0",
"@capacitor/app": "^8.0.0",
"@capacitor/splash-screen": "^8.0.0"
```

**Detection:** Release build fails with R8 "Missing classes" errors. Debug build works. `npm outdated` shows outdated Capacitor packages.

**Phase mapping:** Add a "Capacitor dependency audit" step before the signing/release phase.

---

### Pitfall 6: Gradle/AGP/Android Studio Version Mismatch

**What goes wrong:** Capacitor v8 requires very specific, recent versions: Android Studio Otter (2025.2.1+), AGP 8.13.0, Gradle 8.14.3, compileSdk/targetSdk 36, Java 21+, Node 22+. If the developer has an older setup (earlier Android Studio, different Java, older Node), `npx cap open android` shows Gradle sync errors, "Minimum supported Gradle version is X" errors, or AGP compatibility warnings.

**Why it happens:** The project's `android/` directory is generated fresh by `npx cap add android`, which creates Gradle files targeting Capacitor 8's required versions. The developer's local toolchain may not match.

**Consequences:**
- Android Studio refuses to sync the project
- `npx cap build android` fails immediately
- Newcomers think their project setup is broken

**Prevention:**
1. Before running `npx cap add android`, verify:
   - Node >= 22 (`node -v`)
   - Java 21 (`java -version`)
   - Android Studio installed and updated
2. After `npx cap add android`, run `npx cap open android` and let Android Studio auto-suggest AGP/Gradle upgrades
3. Use Android Studio's `Tools → AGP Upgrade Assistant` if version warnings appear
4. If stuck on older Android Studio, the project cannot use Capacitor 8 — downgrade to Capacitor 7 (not recommended)

**Detection:** `npx cap open android` → Gradle sync errors. Or: `npx cap build android` → Gradle build failed.

**Phase mapping:** Pre-flight setup phase must include toolchain version verification.

---

## Moderate Pitfalls

### Pitfall 7: Forgetting to Run `npx cap sync` After Config Changes

**What goes wrong:** Developer changes `capacitor.config.ts` (adds server settings, plugin config, or app name), then builds directly — but the changes don't take effect. Native Android project still has old config.

**Why it happens:** `capacitor.config.ts` changes must be propagated to the native `android/` project. `npx cap sync` does this. Many first-timers expect the config to be read at build time, not copied at sync time.

**Consequences:**
- Config changes mysteriously don't work
- Developer wastes time editing AndroidManifest.xml directly (which works, but gets overwritten on next sync)

**Prevention:**
1. Mental model: `capacitor.config.ts` → `npx cap sync` → native android project
2. After every config change, run: `npm run build && npx cap sync android`
3. Or use `npx cap copy android` if just web assets changed (faster, but doesn't update native configs — use `sync` when config changes)

**Detection:** Config value appears in `capacitor.config.ts` but native `AndroidManifest.xml` doesn't reflect it.

**Phase mapping:** Include sync step in the dev workflow documentation.

---

### Pitfall 8: Back Button Conflict — App Exits Unexpectedly

**What goes wrong:** On Android, pressing the hardware back button exits the app entirely instead of navigating back through the app's screens. Or, the back button navigates back when it shouldn't (e.g., on the login screen).

**Why it happens:** Capacitor's `@capacitor/app` plugin intercepts the back button. If its listener for `backButton` events is registered, it disables default back behaviour. But if the listener isn't registered, the default behaviour is WebView's `goBack()` — which navigates out of the app if there's no history.

The conflict between Ionic's `Platform.backButton.subscribe()` (if using Ionic) and Capacitor's `App.addListener('backButton', ...)` causes duplicate handlers that fight each other.

Additionally, `@capacitor/app` installs an `OnBackPressedCallback` that blocks Android 13+'s predictive back gesture by default, unless `disableBackButtonHandler: true` is set.

**Prevention:**
1. Avoid using Ionic's back button API alongside Capacitor's — pick one
2. For a plain Capacitor (non-Ionic) app: register `App.addListener('backButton', ...)` once and handle nav logic there
3. If you don't need custom back handling at all, set in `capacitor.config.ts`:
```ts
plugins: {
  App: {
    disableBackButtonHandler: true
  }
}
```
4. For this project (simple PIN→dashboard→rate-check), consider `disableBackButtonHandler: true` and rely on in-app navigation buttons

**Detection:** App exits on back press instead of navigating. Or predictive back gesture doesn't work on Android 13+.

**Phase mapping:** Include back button strategy decision in the navigation/UX design for the app.

---

### Pitfall 9: Blank/White Screen After Splash

**What goes wrong:** App shows splash screen, then goes to a blank white screen. No errors in console. WebView loads but nothing renders.

**Why it happens:**
1. **WebView cache issue** (rare, mostly on Chinese OEM devices like Ulefone): Old WebView data conflicts with new app build. Fix: clear app cache.
2. **Missing polyfills**: The app targets modern JS features but the device's WebView is old. The `.browserslistrc` file doesn't include Android WebView versions. Fix: configure `browserslist` to include Android WebView >= 60.
3. **`server.url` misconfiguration**: If `capacitor.config.ts` sets `server.url` to a dev server that's no longer running, the WebView tries to load from a URL that doesn't exist and shows a blank white page.
4. **Route guard / auth redirect loop**: App immediately redirects to `/login`, router replaces, page stays blank.

**Prevention:**
1. Never set `server.url` in production config — only use it for live reload dev
2. Create `.browserslistrc` with: `last 2 ChromeAndroid versions, last 2 Android versions`
3. Add a console.log or visible loading state before routes resolve — helps distinguish "blank" from "routing not done"
4. Test on a real device, not just emulator

**Detection:** Splash shows, then blank. `chrome://inspect` shows no console errors. If the WebView loaded the page at all, you'll see `index.html` in the inspector source panel.

**Phase mapping:** Include "blank screen troubleshooting" in QA/testing phase documentation.

---

### Pitfall 10: `server.hostname` Collision with Production Domain

**What goes wrong:** Developer sets `server.hostname` to the same domain as the production API server (e.g., `example.com`). Local API requests to `https://example.com/api` get intercepted by the local WebView server instead of going to the real server.

**Why it happens:** Capacitor serves the web app at `{androidScheme}://{hostname}`. If `hostname` matches your API domain, the WebView tries to resolve API requests locally.

**Prevention:**
1. Keep `hostname` as the default `'localhost'` for this project
2. Use the full absolute URL (`http://84.235.249.239:3000/api/...`) in API calls — don't use relative paths
3. Never set `hostname` to match a production server domain

**Detection:** API calls to your server return unexpected HTML or fail with connection errors. `chrome://inspect` shows the request went to the local server.

**Phase mapping:** API integration phase — verify server URL configuration before testing.

---

### Pitfall 11: SSL/HTTPS Handshake Failure on Android

**What goes wrong:** The app connects to an HTTPS API that works fine in the browser, but on Android the Capacitor WebView fails with `ssl_client_socket_impl.cc handshake failed` error. iOS works, Android doesn't.

**Why it happens:** Android's WebView has stricter TLS requirements than desktop browsers. Common causes:
- Server uses an incomplete certificate chain (missing intermediate CA)
- Server only supports TLS 1.0/1.1 (Android requires TLS 1.2+)
- Server uses a self-signed certificate

**Note for this project:** The existing backend at `http://84.235.249.239:3000` uses plain HTTP, so this pitfall is **not directly applicable** unless HTTPS is added later. However, if any third-party APIs (analytics, maps) are added with HTTPS, this can strike.

**Prevention:**
1. Use `https://www.ssllabs.com/ssltest/` to verify server certificate chain
2. Ensure the server supports TLS 1.2 minimum
3. If dealing with self-signed certs in dev, install the CA cert on the device
4. Do NOT install `ssl-skip` plugins in production — they bypass all SSL validation

**Phase mapping:** If HTTPS is ever considered for the backend, add SSL verification testing to the release checklist.

---

## Minor Pitfalls

### Pitfall 12: Missing ProGuard Rules After Adding Plugins

**What goes wrong:** After adding `@capacitor/preferences` (or other plugins), a release build fails with R8 "Missing classes" errors specific to that plugin. Debug builds work fine.

**Prevention:**
1. Keep all Capacitor plugins on latest compatible versions (run `npm outdated` before build)
2. Run `npx cap sync android` after adding any plugin
3. If persistent, check the plugin's `android/build.gradle` for `getDefaultProguardFile('proguard-android.txt')` — it should be `'proguard-android-optimize.txt'` (known issue with older plugin versions)

---

### Pitfall 13: `cap run` Uses Port 3000 by Default

**What goes wrong:** Running `npx cap run android -l` automatically uses port 3000 for the dev server, but the project's bundler (Vite, webpack) uses a different port (e.g., 5173, 8080). The app opens and tries to connect to port 3000 — blank screen.

**Prevention:**
1. Always specify the port: `npx cap run android -l --port 5173` (or whatever your bundler uses)
2. Or set up the dev workflow to run the bundler with live reload on port 3000
3. Read the actual bundler output to see which port it's using

---

### Pitfall 14: Android Studio's AGP Upgrade Prompt (False Alarm)

**What goes wrong:** After `npx cap open android`, Android Studio shows a banner: "The project is using an incompatible version (AGP 8.13.0). Latest supported version is AGP 8.12.2" — but the project builds fine.

**Prevention:**
1. This is a display issue with older Android Studio trying to validate against its own bundled AGP list
2. Verify that Android Studio is updated to Otter (2025.2.1+)
3. If the project builds, ignore the warning — Capacitor 8 targets AGP 8.13.0 by design
4. Do NOT downgrade AGP unless the build actually fails

---

### Pitfall 15: Screen Orientation Lock Fails on Android 16+ Tablets

**What goes wrong:** `ScreenOrientation.lock('portrait')` doesn't work on tablets running Android 16+ with targetSdk 36.

**Prevention:**
1. This is expected behaviour — Android 16+ disallows orientation lock on large screens
2. For this project (phone app, read-only), this likely won't be an issue
3. If tablet support is needed, use `android:window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` opt-out (temporary, removed in Android 17)

---

### Pitfall 16: CI/CD Build Fails Due to Windows Commands

**What goes wrong:** The `package.json` build script uses Windows-specific commands (`xcopy`, `rd`, `copy`), but CI/CD runs on Linux (GitHub Actions). The build fails on CI.

**Prevention:**
1. Use cross-platform tools like `shx` or `rimraf` for file operations in scripts
2. Or use Node.js scripts instead of shell commands for build steps
3. For this project: since Electron uses `.ico` files and Windows-specific paths, the CI build config for Android must use a separate, cross-platform-compatible script

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| **Setup / Environment** | AGP/Gradle/Node/Java version mismatch (Pitfall 6) | Verify toolchain versions before running `npx cap add android` |
| **Capacitor Init** | `androidScheme` defaults to `https`, but backend uses HTTP (Pitfall 3) | Set `androidScheme: 'http'` and `cleartext: true` from day one |
| **API Integration** | HTTP cleartext blocked, API fails silently (Pitfall 3) | Create `network_security_config.xml` and enable cleartext |
| **Dev Workflow** | Live reload strips server config (Pitfall 4) | Avoid live reload during API testing; always `npx cap sync` after |
| **Navigation / UX** | Back button exits app instead of navigating (Pitfall 8) | Decide back button strategy upfront: `disableBackButtonHandler: true` or custom listener |
| **Plugin Usage** | Plugin version mismatch breaks release builds (Pitfall 5) | Run `npm outdated` before signing; sync after updates |
| **APK Signing** | Wrong signing tool — APK rejected on Android 11+ (Pitfall 2) | Explicitly set `signingType: 'apksigner'` AND `releaseType: 'APK'` |
| **Keystore** | Keystore lost — can't update app (Pitfall 1) | Back up keystore, use env vars for passwords, `.gitignore` the file |
| **Release / Build** | R8 minification kills plugin classes (Pitfall 12) | Keep plugins updated; run a test signed build early |
| **QA / Testing** | White screen on certain devices (Pitfall 9) | Test on real device, clear cache on each install, check `.browserslistrc` |
| **CI/CD** | Platform-specific build scripts fail (Pitfall 16) | Use cross-platform tools for build scripts |

---

## Quick Reference Checklist

Run through these before considering the APK "done":

- [ ] Keystore generated, backed up, passwords stored securely
- [ ] `capacitor.config.ts` sets `androidScheme: 'http'` and `cleartext: true`
- [ ] `network_security_config.xml` created and referenced in `AndroidManifest.xml`
- [ ] All `@capacitor/*` packages on latest compatible versions
- [ ] Android Studio updated to Otter+ (2025.2.1+)
- [ ] Node >= 22, Java >= 21, Gradle project synced
- [ ] `signingType: 'apksigner'` set in config or passed as CLI flag
- [ ] Back button behaviour decided and tested
- [ ] `npx cap sync android` run after final config changes
- [ ] APK tested via `adb install` on an Android 11+ device
- [ ] `.gitignore` includes `*.jks`, `*.keystore`, `local.properties`, `android/.idea/`

---

## Sources

- [Capacitor 8 Upgrade Guide](https://capacitorjs.com/docs/updating/8-0) — official breaking changes and version requirements
- [Capacitor Android Troubleshooting](https://capacitorjs.com/docs/android/troubleshooting) — official troubleshooting docs
- [Capacitor Build CLI Docs](https://capacitorjs.com/docs/cli/commands/build) — signing options reference
- [Bug #8106: cap build android generates broken signed apk](https://github.com/ionic-team/capacitor/issues/8106) — jarsigner vs apksigner confirmed
- [Bug #8428: apksigner with AAB fails cryptically](https://github.com/ionic-team/capacitor/issues/8428) — signing tool incompatibility documented
- [Bug #7054: apksigner endless loop with single key](https://github.com/ionic-team/capacitor/issues/7054) — password pass: prefix workaround
- [Bug #8355: ProGuard rule deprecation in plugins](https://github.com/ionic-team/capacitor/issues/8355) — proguard-android.txt vs -optimize.txt
- [Bug #8352: Live reload destroys server config](https://github.com/ionic-team/capacitor/issues/8352) — config merge bug
- [Bug #8094: cleartext in wrong manifest](https://github.com/ionic-team/capacitor/issues/8094) — cleartext placement by design
- [Bug #6875: hostname collision with API domain](https://github.com/ionic-team/capacitor/issues/6875) — same-domain conflict
- [Forum: Missing classes when building signed AAB](https://forum.ionicframework.com/t/missing-classes-when-building-signed-aab/250494) — R8 fix via npm update
- [Forum: CORS issue on Android — actually cleartext](https://forum.ionicframework.com/t/cors-issue-on-android-though-http-localhost-is-added-on-backend/220319) — cleartext vs CORS confusion documented
- [Forum: SSL handshake failed Android](https://forum.ionicframework.com/t/android-ssl-handshake-failed-when-making-external-api-requests-in-capacitor-app/247120) — TLS issues on Android WebView
- [Capawesome: Android Troubleshooting Guide](https://capawesome.io/blog/troubleshooting-capacitor-android-issues/) — plugin not implemented, blank screen, Gradle errors
- [LearnSA2Z: Ultimate Capacitor Cheat Sheet](https://www.learnsa2z.com/2026/04/the-ultimate-capacitor-android-developer-cheat-sheet.html.html) — AGP mismatch, ADB install, GitHub Actions issues
- [Medium: Ionic HTTP Not Working on LAN](https://medium.com/@aliyousefi-dev/ionic-http-not-working-on-lan-after-build-capacitor-fix-for-android-9-2fdd279aea84) — cleartext fix for Android 9+
