# Stack: Stock Management

**Mapped:** 2026-06-24
**Focus:** Technology stack and dependencies

## Languages & Runtime

- **JavaScript (ES2020+)** — All application code (main process, renderer, preload, server)
- **Node.js** — v18+ (Electron v31 requires Node 18+)
- **Electron v31.7.7** — Desktop application framework, Chromium-based renderer

## Frontend

- **Vanilla JavaScript** (no framework) — Renderer process (`src/renderer.js`)
- **HTML5** — Single-page app (`src/index.html`)
- **CSS3** — Custom styles with CSS variables (`src/styles.css`)
- **Intl API** — Locale-aware currency/number formatting (`en-PK`)

## Backend / API

- **Express v5.2.1** — HTTP server for mobile API access (`src/server.js`)
- **CORS** — Cross-origin resource sharing enabled
- Port **3000** — API server listening on `0.0.0.0`

## Desktop Integration

- **Electron IPC** — `contextBridge` + `ipcRenderer`/`ipcMain` for secure renderer↔main communication
- **Electron Build v24.13.3** — Packaging with electron-builder (Windows NSIS target)
- **Preload script** — `contextIsolation: true`, `nodeIntegration: false` (security best practice)

## Data Storage

- **JSON file** — User data directory (`app.getPath("userData")/stock-data.json`)
- **No database** (currently) — Data persists as flat JSON, not normalized

## PDF Export

- **Electron `printToPDF`** — Hidden BrowserWindow with offscreen rendering for PDF report generation

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| electron | ^31.7.7 | Desktop application framework |
| express | ^5.2.1 | HTTP API server for mobile access |
| cors | ^2.8.6 | CORS middleware for API |
| electron-builder | ^24.13.3 | Windows installer packaging |
| jimp | ^1.6.1 | Image processing (icon generation) |
| png-to-ico | ^3.0.1 | PNG to ICO conversion |

## Build & Packaging

- **electron-builder** — Windows NSIS installer
- Output: `dist/Stock Management Setup *.exe`
- Single-arch: Windows x64 only
