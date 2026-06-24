# Conventions: Stock Management

**Mapped:** 2026-06-24
**Focus:** Code style, naming, patterns, and error handling

## Code Style

### JavaScript
- ES2020+ syntax (optional chaining, nullish coalescing)
- `const` by default, `let` where reassignment needed
- No TypeScript — all plain JavaScript
- Arrow functions for callbacks and short functions
- Template literals for string interpolation

### HTML
- Semantic HTML5 elements (`section`, `article`, `nav`, `header`, `footer`)
- Data attributes for state binding (`data-tab`, `data-delete`)
- `datalist` for autocomplete suggestions
- Single `<script>` tag at end of body

### CSS
- CSS custom properties for theming (`--bg-deep`, `--brand`, `--good`, `--bad`)
- BEM-like class naming (`.metric-card`, `.type-badge.in`)
- Responsive grid with `min-width` breakpoints
- No CSS preprocessor

## Patterns

### State Management
- Central `state` object (`src/renderer.js:1-4`)
- `render()` function called after every state change
- Computed values derived on each render via `getBalances()`
- Not reactive — full re-render on every update

### IPC Pattern
- `preload.js` exposes `window.stockApi` via `contextBridge`
- Renderer calls `window.stockApi.action(payload)`
- Main process handles via `ipcMain.handle("channel", handler)`
- Async invocation pattern (renderer awaits promise)

### Form Handling
- Single form submit handler (`handleSubmit`)
- Extracts via `FormData` API
- Generates UUID via `crypto.randomUUID()`
- Validates required fields, saves, resets, navigates

### Event Binding
- Manual `addEventListener` calls in `bindEvents()` (`src/renderer.js:308-337`)
- Delegation for dynamic content (e.g., delete buttons via `event.target.closest`)
- Input events for live search/filter

## Error Handling

- File read: catches `ENOENT` (file not found) silently, returns empty data
- File write: no specific error handling (will throw)
- PDF export: try/catch with user-facing alert
- API validation: basic field checks (`entry.quantity <= 0 || entry.rate < 0`)
- No centralized error handler or logging framework

## Security Patterns

- `contextIsolation: true` — renderer cannot access Node.js
- `nodeIntegration: false` — no direct `require()` in renderer
- Escape HTML output via custom `escapeHtml()` function
- PIN-based API auth via request headers (hardcoded — needs improvement)
- No input sanitization for API endpoints
