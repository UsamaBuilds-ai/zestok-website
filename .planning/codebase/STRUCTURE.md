# Structure: Stock Management

**Mapped:** 2026-06-24
**Focus:** Directory layout, key locations, and naming conventions

## Directory Layout

```
D:\Stock Management\
├── src/                          # Application source code
│   ├── main.js                   # Electron main process
│   ├── renderer.js               # Browser renderer logic
│   ├── preload.js                # IPC bridge (contextBridge)
│   ├── server.js                 # Express HTTP API server
│   ├── index.html                # SPA HTML shell
│   └── styles.css                # Application styles
├── Icons/                        # Application icons
│   └── app.ico / ico.ico
├── scripts/
│   └── generate-icon.js          # Icon generation utility
├── dist/                         # Build output
├── .planning/                    # GSD planning docs
│   └── codebase/                 # Codebase map (this directory)
├── package.json                  # Project config & dependencies
├── main.js                       # Legacy root alias (not used)
├── renderer.js                   # Legacy root alias (not used)
├── server.js                     # Legacy root alias (not used)
└── styles.css                    # Legacy root alias (not used)
```

## Key File Locations

### Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/main.js` | 153 | Electron main process, IPC handlers, PDF export |
| `src/renderer.js` | 348 | All UI logic, state management, event handling |
| `src/preload.js` | 7 | Secure IPC bridge (minimal) |
| `src/server.js` | 36 | Express API for mobile access |
| `src/index.html` | 184 | Single-page app structure |
| `src/styles.css` | 368 | Complete styling |

## Naming Conventions

- **Files:** kebab-case (`renderer.js`, `styles.css`, `stock-data.json`)
- **Functions:** camelCase (`getBalances`, `renderBalanceRows`, `handleSubmit`)
- **Constants:** UPPER_SNAKE for globals (`SECRET_PIN`, `PORT`)
- **IPC channels:** namespace:action (`stock:load`, `stock:save`, `stock:export-report-pdf`)
- **HTML IDs:** camelCase (`#dashboardSearch`, `#balanceRows`)
- **CSS classes:** kebab-case (`metric-card`, `type-badge`, `panel-title`)
- **Data attributes:** kebab-case (`data-tab`, `data-delete`)

## Module Organization

Application is structured as a flat module layout (no subdirectories):
- Single main process file
- Single renderer file (all UI in one file)
- Single server file
- No component/module splitting

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, build config, metadata |
| `builder-debug.yml` | electron-builder debug log |
| `builder-effective-config.yaml` | Resolved build configuration |
