# Pitfalls Research: Stock Management Mobile App

**Date:** 2026-06-24

## Critical Pitfalls

### 1. PostgreSQL Connection from Electron (HIGH)
- **Issue:** Electron main process runs in Node.js, connecting to PostgreSQL requires the `pg` module
- **Risk:** `pg` uses native modules (libpq) which can cause build issues with Electron's custom Node.js runtime
- **Fix:** Use `pg` with `pg.js` (pure JavaScript fallback) by requiring `pg/lib/index.js` directly, or rebuild native modules for Electron

### 2. Capacitor Android Build Requirements (HIGH)
- **Issue:** Building APK requires Android Studio, Android SDK, JDK 17+
- **Risk:** If these aren't installed, the build fails with confusing errors
- **Fix:** Document exact setup steps. Provide a batch script to verify prerequisites before build starts

### 3. Data Migration from JSON to PostgreSQL (MEDIUM)
- **Issue:** Existing data in `stock-data.json` must be migrated to PostgreSQL
- **Risk:** Data loss if migration script has bugs (especially with concurrent data entry)
- **Fix:** Create a migration script that reads JSON and inserts in a transaction. Keep JSON file as backup

### 4. PIN Security (MEDIUM)
- **Issue:** PIN stored in database, transmitted over HTTP in cleartext
- **Risk:** Network sniffing on local network can expose the PIN
- **Fix:** Hash the PIN with bcrypt before storing. For v1, HTTPS is not necessary on local network, but add a warning in docs

### 5. Express Server Availability (MEDIUM)
- **Issue:** Mobile app requires the desktop Express server to be running
- **Risk:** If desktop app is closed, mobile app shows no data
- **Fix:** Add clear error state in mobile app. Consider auto-starting Express server in background even when app window is closed

## Moderate Pitfalls

### 6. Database Connection Pool Exhaustion
- Multiple mobile clients connecting simultaneously could exhaust connection pool
- Set pool max connections reasonably (5-10 for local deployment)

### 7. Concurrent Write Conflicts
- Desktop and API both writing to PostgreSQL could conflict
- Use transactions for write operations, avoid long-running transactions

### 8. Cross-Platform Path Issues
- PostgreSQL on Windows uses backslashes in paths
- Use `path.resolve()` for any file paths, not hardcoded separators

### 9. Android APK Signing
- APKs must be signed for installation on devices
- Generate a debug keystore initially, document release signing separately

### 10. Network IP Changes
- Desktop IP can change on DHCP networks
- Mobile app needs configurable server IP. Show IP on desktop settings page
