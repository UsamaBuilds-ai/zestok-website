# Technology Stack

**Analysis Date:** 2026-07-07

## Languages

**Primary:**
- **JavaScript (Node.js)** - Core application language used across Electron main process (`src/main.js`), Express server (`src/server.js`), renderer (`src/renderer.js`), preload bridge (`src/preload.js`), and all supporting modules.
- **HTML5 / CSS3** - Frontend UI rendered in Electron BrowserWindow (`src/index.html`, `src/styles.css`).

**Secondary:**
- **SQL** - PostgreSQL DDL and query patterns found in `src/db/schema.sql`, `src/db/pool.js`, and inline in `src/server.js`.

## Runtime

**Environment:**
- **Node.js** 18+ (required by Electron 31)
- **Electron** `^31.7.7` — Desktop shell running Chromium + Node.js

**Package Manager:**
- **npm** - Lockfile: `package-lock.json` (lockfileVersion 3)

## Frameworks

**Core:**
- **Express** `^5.2.1` — REST API server for backend (`src/server.js`, `server/index.js`)
- **Electron** `^31.7.7` — Desktop application framework (`src/main.js`, `src/preload.js`)

**Testing:**
- **Node --test** (built-in) — Test runner configured via `"test": "node --test"` in `package.json`
- **supertest** `^7.2.2` — HTTP assertion library for Express route testing (dev dependency)

**Build/Dev:**
- **electron-builder** `^24.13.3` — Windows installer packaging (NSIS target)
- **electron-updater** `^6.3.0` — Auto-update mechanism via GitHub releases

## Key Dependencies

**Critical:**
- **pg** `^8.22.0` — PostgreSQL client (Pool-based connection management in `src/db/pool.js`; direct Client usage in migrations and admin queries)
- **bcrypt** `^6.0.0` — Password/PIN hashing for both local (Electron main process) and server-side authentication
- **express-rate-limit** `^8.5.2` — Rate limiting middleware applied to authentication endpoints
- **speakeasy** `^2.0.0` — TOTP (time-based one-time password) generation and verification for 2FA
- **qrcode** `^1.5.4` — QR code generation for TOTP setup
- **dotenv** `^17.4.2` — Environment variable loading from `.env` files

**Infrastructure:**
- **cors** `^2.8.6` — CORS middleware for Express server
- **icojs** `^1.0.0` — ICO file parsing for app icons
- **@capacitor/android** `^8.4.1` — Listed as dependency but Android/iOS bridge not observed in source

**Build-time:**
- **jimp** `^1.6.1` — Image manipulation for icon generation
- **png-to-ico** `^3.0.1` — PNG to ICO conversion for Windows installer icon

## Configuration

**Environment:**
- Loaded via `dotenv` from two `.env` files:
  - Root `.env` — Server configuration (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL, API_PORT, SSL_CERT_PATH, etc.)
  - `server/.env` — Duplicate/sample configuration (contains placeholder values)
- Runtime config stored in Electron `userData` directory:
  - `app-config.json` — Contains `apiUrl`, `deviceToken`, `companyName`
  - `stock-pin.json` — Contains `pin_hash`, `tenant_id`, `company_name`
  - `stock-data.json` — Contains serialized stock entries array

**Build:**
- `package.json` `"build"` section — Electron Builder config for Windows NSIS installer
- `build/installer.nsh` — Custom NSIS installer script (process cleanup, shortcut removal)
- `electron-builder` reads config from `package.json` no separate config file

## Platform Requirements

**Development:**
- Node.js 18+
- npm
- PostgreSQL database (accessible)
- Windows build tools (for packaging)

**Production:**
- Windows (NSIS installer produced via `electron-builder --win`)
- Self-hosted Express server (Oracle Cloud mentioned in `server/package.json` description)
- PostgreSQL database

---

*Stack analysis: 2026-07-07*
