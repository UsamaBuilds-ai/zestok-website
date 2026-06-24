# Architecture: Stock Management

**Mapped:** 2026-06-24
**Focus:** System design, patterns, data flow, and abstractions

## Architecture Pattern

Desktop application with **Process Separation** (Electron Main + Renderer) and an auxiliary **HTTP API Server** for mobile access.

```
┌─────────────────────────────────────────────────────────┐
│                 Electron Application                     │
│                                                         │
│  ┌──────────────────┐   IPC (contextBridge)             │
│  │  Main Process    │◄────────────────────┐             │
│  │  (src/main.js)   │                      │             │
│  │                  │  stock:load          │             │
│  │  - Window mgmt   │  stock:save          │             │
│  │  - File I/O      │  stock:export-       │             │
│  │  - PDF export    │    report-pdf        │             │
│  │                  │                      │             │
│  │  Express Server  │                      │             │
│  │  (src/server.js) │  ┌──────────────────┐│             │
│  │  Port 3000       │  │  Renderer (Web)  ││             │
│  │                  │  │  (src/renderer.js)││             │
│  └──────────────────┘  │  - Dashboard      ││             │
│         │              │  - Entry form     ││             │
│         │ HTTP/JSON    │  - Reports        ││             │
│         ▼              │  - Export CSV/PDF ││             │
│  ┌──────────┐          └──────────────────┘│             │
│  │ Mobile   │                              │             │
│  │ Clients  │                              │             │
│  └──────────┘                              │             │
└─────────────────────────────────────────────────────────┘
```

## Layers

### 1. Main Process (`src/main.js`)
- Window creation and lifecycle
- IPC handler registration for CRUD operations
- File-based JSON persistence via `createStore()` factory
- PDF generation through hidden offscreen BrowserWindow

### 2. Renderer Process (`src/renderer.js`)
- SPA with tab-based navigation (Dashboard, Entry, Report)
- Computed state: balance calculations from flat entry array
- Event-driven UI updates via `render()` function

### 3. HTTP API Server (`src/server.js`)
- Express-based REST API for mobile/network access
- PIN-based authentication middleware
- Currently returns mock data — designed for database integration

### 4. Preload Bridge (`src/preload.js`)
- Secure IPC bridge exposing `window.stockApi` API
- `contextIsolation: true` prevents renderer access to Node.js APIs

## Data Flow

### Desktop App Flow
```
User Action → Renderer Event → IPC invoke → Main Handler → File Read/Write → Response → UI Update
```

### Mobile API Flow (Planned Enhancement)
```
Mobile App → HTTP GET /api/stock → PIN Auth → DB Query → JSON Response → Mobile Display
```

## Data Model

```javascript
// Entry (transaction record)
{
  id: "uuid",           // crypto.randomUUID()
  date: "2024-01-15",   // ISO date string
  type: "in"|"out",     // Stock in or out
  item: "Rice 25kg",    // Item name
  category: "Grocery",  // Item category
  quantity: 50,         // Numeric quantity
  rate: 3200,           // Latest rate for "in", auto-populated for "out"
  note: "Supplier A",   // Free text note
  createdAt: "ISO"      // Creation timestamp
}
```

### Computed State (Balance)
```javascript
{
  item: "Rice 25kg",
  category: "Grocery",
  inQty: 100,
  outQty: 30,
  balance: 70,
  latestRate: 3200,
  value: 224000
}
```

## Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| Electron main | `src/main.js:31` | `createWindow()` — app startup |
| Express server | `src/server.js:1` | HTTP server bootstrap |
| Renderer SPA | `src/index.html:1` | DOM entry for web UI |
| Renderer logic | `src/renderer.js:339` | `init()` — data load + event binding |

## Key Abstractions

- **Store factory** (`src/main.js:6`): `createStore()` returns `{ read, write }` — wraps file I/O
- **Balance calculator** (`src/renderer.js:22`): `getBalances()` — aggregates entries into item balances
- **State object** (`src/renderer.js:1`): Central state with `entries[]` and `activeTab`
- **Preload bridge** (`src/preload.js:3`): `contextBridge.exposeInMainWorld("stockApi", {...})`
