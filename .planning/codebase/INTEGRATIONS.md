# Integrations: Stock Management

**Mapped:** 2026-06-24
**Focus:** External APIs, data sources, and service integrations

## Current Integrations

### Express HTTP API (Mobile Access)
- **File:** `src/server.js`
- **Endpoint:** `GET /api/stock` — Returns stock data as JSON
- **Auth:** PIN-based via `x-access-pin` header (hardcoded `SECRET_PIN = "1234"`)
- **Data:** Currently returns mock/static data (no real database connection)
- **Network:** Listens on `0.0.0.0:3000` for local network access
- **Status:** Prototype/gateway — ready for real database integration

### File System (Local Persistence)
- **File:** `src/main.js` (lines 6-27)
- **Storage path:** `app.getPath("userData")/stock-data.json`
- **Format:** Flat JSON array of entry objects
- **Mechanism:** `fs.readFile` / `fs.writeFile` with atomic serialization
- **Status:** Production — all desktop data goes through this

## Planned Integrations (Not Yet Implemented)

- **PostgreSQL** — User has requested PostgreSQL integration for mobile data sync
- **Android APK** — Mobile app that connects to the Express API
- **PIN Auth System** — User-created PIN (currently hardcoded mock)
