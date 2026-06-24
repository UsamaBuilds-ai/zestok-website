# Stack Research: Stock Management Mobile App

**Date:** 2026-06-24

## Recommended Stack

### Mobile App: Capacitor (Vanilla JS)
- **Capacitor v8** — Latest stable. Wraps web apps into native Android APK.
- **No Ionic Framework needed** — The stock app UI is simple (list + search). Vanilla HTML/CSS/JS is sufficient and avoids framework overhead.
- **Capacitor Android plugin** — `@capacitor/android` for Android platform.
- **Capacitor HTTP plugin** — For API calls to the Express server.

### Database: PostgreSQL
- **PostgreSQL 16+** — Latest stable for local Windows deployment.
- **`pg` (node-postgres)** — Node.js PostgreSQL client for Express server.
- **pgAdmin 4** — GUI for database management (included with PostgreSQL installer).

### API Layer
- **Express v5** — Already in the project. Extend with proper PostgreSQL connection pool.
- **pg (node-postgres)** — Native PostgreSQL client with connection pooling.

### Desktop App (Existing - No Change)
- **Electron v31** — Already running. Connect to PostgreSQL instead of JSON file.
- **electron-builder** — Already configured for Windows NSIS packaging.

## Installation Requirements

### PostgreSQL Setup (Windows)
1. Download PostgreSQL 16+ installer from [EDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. Run installer, set password for `postgres` user
3. Add PostgreSQL `bin/` to PATH
4. Install `pg` npm module: `npm install pg`
5. Create database and tables via SQL script

### Android Build Requirements
1. Node.js 18+ (already installed)
2. Android Studio (for Android SDK + build tools)
3. Java 17+ (bundled with Android Studio)
4. Capacitor CLI: `npm install -g @capacitor/cli`
