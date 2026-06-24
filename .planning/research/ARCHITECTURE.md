# Architecture Research: Stock Management

**Date:** 2026-06-24

## System Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   Mobile App    │     │         Desktop (Electron)           │
│  (Capacitor)    │     │                                      │
│                 │     │  ┌──────────────┐  ┌──────────────┐  │
│  Vanilla JS     │     │  │ Main Process │  │  Renderer    │  │
│  Stock Viewer   │     │  │ (Node.js)    │  │  (Web UI)    │  │
│                 │     │  └──────┬───────┘  └──────────────┘  │
│  - PIN Entry    │     │         │                             │
│  - Stock List   │     │  ┌──────▼───────┐                    │
│  - Search       │     │  │ Express API  │                    │
│  - Categories   │     │  │ (Port 3000)  │                    │
│                 │     │  └──────┬───────┘                    │
└────────┬────────┘     └─────────┼────────────────────────────┘
         │                        │
         │     HTTP/JSON          │
         └──────────┬─────────────┘
                    │
         ┌──────────▼─────────────┐
         │     PostgreSQL 16+     │
         │                        │
         │  stock_entries         │
         │  stock_items (view)    │
         │  app_settings (PIN)    │
         └────────────────────────┘
```

## Component Boundaries

### 1. PostgreSQL Database
- Single database on the desktop machine
- Tables: `stock_entries`, `app_settings`
- Views: `stock_balance` (computed from entries)
- Connection: Localhost on default port 5432

### 2. Express API (`src/server.js`)
- Connect to PostgreSQL via `pg` pool
- Endpoints:
  - `GET /api/stock` — Returns grouped stock balance by category
  - `GET /api/pin/verify` — Verify PIN for mobile access
  - `GET /api/pin/status` — Check if PIN is configured
- PIN verification via request header

### 3. Desktop Main Process (`src/main.js`)
- Replace JSON file storage with PostgreSQL
- Keep existing IPC handlers, change data source
- Add IPC handler for PIN management
- Add IPC handler for database health check

### 4. Desktop Renderer (`src/renderer.js`)
- Add PIN settings page in a new tab
- Keep existing dashboard/entry/report tabs
- All data flows through PostgreSQL now

### 5. Mobile App (Capacitor)
- Separate project in `mobile/` directory
- Entry point: PIN verification screen
- Main screen: Category-grouped stock list with search
- Auto-refresh on app foreground

## Data Flow

### Write Path (Desktop → DB)
```
Desktop Entry Form → IPC → Main Process → pg INSERT → PostgreSQL
```

### Read Path (Mobile → DB)
```
Mobile App → HTTP GET → Express API → pg Query → JSON Response → Mobile UI
```

### Read Path (Desktop → DB)
```
Desktop Dashboard → IPC → Main Process → pg Query → JSON → Render
```

## Build Order

1. **PostgreSQL setup** — Install DB, create schema, seed data migration
2. **Express API with PG** — Replace mock with real queries
3. **Desktop PG migration** — Desktop reads/writes to PostgreSQL
4. **Desktop PIN management** — UI for setting mobile access PIN
5. **Mobile app** — Capacitor project, stock viewer, PIN screen
6. **APK build** — Generate distributable APK
