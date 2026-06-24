# Research Summary: Stock Management Mobile

**Date:** 2026-06-24

## Key Findings

### Stack
- **Capacitor v8** (vanilla JS) for Android APK — No heavy framework needed
- **PostgreSQL 16+** with `pg` module for database
- **Express v5** (existing) extended with `pg` connection pool
- **Android Studio** required for APK build

### Features
- **Table stakes:** Stock list with search, categories, PIN access
- **Differentiator:** Desktop+Mobile sync via shared PostgreSQL
- **Anti-features:** No user accounts, no offline, no edit from mobile

### Architecture
- Desktop → Express API → PostgreSQL (unified data layer)
- Mobile → HTTP API → Express → PostgreSQL (read-only)
- PIN management via desktop settings page

### Pitfalls
1. **Electron + pg native module** — Use pg.js fallback
2. **Android SDK prerequisites** — Document clearly
3. **JSON → PostgreSQL migration** — Transactional script needed
4. **PIN in cleartext** — Hash with bcrypt
5. **Express availability** — Run in background even when app window closed

## Build Order
1. PostgreSQL setup + schema
2. Express API with real pg queries
3. Desktop PG migration
4. Desktop PIN management UI
5. Mobile app (Capacitor)
6. APK build
