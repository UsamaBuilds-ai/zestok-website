# 04-04 SUMMARY: Biometric Unlock on App Resume

## Installed
- `@aparajita/capacitor-biometric-auth@^10.0.0` — Correct package per research pitfall 1 (NOT `@capacitor/biometric`)
- `npx cap sync` completed — Android native project updated

## Modified
- `mobile/src/auth.js` — Added `BiometricAuth`, `BiometryError`, `BiometryErrorType` imports; `tryBiometricAuth()` (check flag → checkBiometry → authenticate), `isBiometricEnabled()`, `clearSession()` now removes `biometricEnabled` flag
- `mobile/src/main.js` — Added `tryBiometricAuth` import; `appStateChange` now attempts biometric first (skip PIN on success, fall back to PIN on failure/cancel)

## Key Decisions
- D-50: Correct plugin `@aparajita/capacitor-biometric-auth`
- D-51: Biometric attempted first on resume; PIN fallback on failure/cancel
- D-52: `biometricEnabled` flag stored in Preferences; cold start always PIN gate
- D-29 modified: app resume biometric-first instead of unconditional PIN gate
- T-04-10 to T-04-13: All biometric threat mitigations applied

## Acceptance
- App compiles and runs after `npx cap sync`
- Cold start: PIN gate (biometric not yet enabled)
- After first PIN unlock: biometric flag set
- On resume: biometric attempted first → PIN on fallback
- Session clear removes biometric flag
