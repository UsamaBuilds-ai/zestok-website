# Concerns: Stock Management

**Mapped:** 2026-06-24
**Focus:** Technical debt, known issues, security, and fragility

## Security Concerns

### Hardcoded PIN (HIGH)
- **File:** `src/server.js:8`
- **Issue:** `SECRET_PIN = "1234"` is hardcoded — no actual PIN verification
- **Risk:** Anyone on the local network can access stock data
- **Fix:** Implement user-configurable PIN with hashing or database-backed auth

### No Input Validation (MEDIUM)
- **File:** `src/server.js:29-32`
- **Issue:** Express `/api/stock` endpoint has no input validation
- **Risk:** SQL injection when database is added; malformed queries
- **Fix:** Add validation middleware when integrating database

### No Rate Limiting (LOW)
- **File:** `src/server.js`
- **Issue:** API has no rate limiting or request throttling
- **Risk:** Brute force attacks on PIN
- **Fix:** Add express-rate-limit when deploying to production

## Technical Debt

### Monolithic Renderer (HIGH)
- **File:** `src/renderer.js` (348 lines)
- **Issue:** All UI logic in a single file — state, rendering, events, formatting, helpers
- **Impact:** Hard to maintain, test, or extend
- **Fix:** Split into modules (state.js, dashboard.js, entry.js, report.js, utils.js)

### No TypeScript (MEDIUM)
- **Issue:** No type safety — entry shapes, function signatures, IPC payloads
- **Impact:** Runtime errors from shape mismatches (e.g., missing fields on entries)
- **Fix:** Add JSDoc type annotations or migrate to TypeScript

### Flat File Storage (MEDIUM)
- **File:** `src/main.js:6-27`
- **Issue:** JSON file storage with no transactions, no indexing, no querying
- **Impact:** Data loss on concurrent writes; slow on large datasets
- **Fix:** PostgreSQL integration (already planned)

### Legacy Root Files (LOW)
- **Files:** `./main.js`, `./renderer.js`, `./server.js`, `./styles.css`
- **Issue:** Duplicate files at project root (actual source in `src/`)
- **Impact:** Confusion about which files are authoritative
- **Fix:** Remove root-level duplicates after confirming `package.json` `"main": "src/main.js"` works

### Mock Data in Server (MEDIUM)
- **File:** `src/server.js:11-16`
- **Issue:** `getStockData()` returns hardcoded test data
- **Impact:** Mobile API shows fake data — useless for real use
- **Fix:** Connect to actual data source (database or share Electron file data)

## Data Integrity Risks

### Concurrent Write Loss (HIGH)
- **File:** `src/main.js:21-24`
- **Issue:** `write()` uses simple `writeFile` — no locking, no atomic swap
- **Risk:** Two rapid saves can overwrite each other's data
- **Fix:** Use atomic writes (write to temp, rename) or DB transactions

### No Data Validation (MEDIUM)
- **File:** `src/renderer.js:228-254`
- **Issue:** Entry validation is basic (type-only checks, no schema)
- **Risk:** Corrupted data can enter the system
- **Fix:** Add schema validation (e.g., zod) for entry objects

## Performance

### Full Re-render (LOW)
- **File:** `src/renderer.js:183-191`
- **Issue:** `render()` recalculates everything on every input
- **Risk:** Perceptible lag with 10,000+ entries
- **Fix:** Debounce search, virtual scrolling for large datasets

### No Indexing (LOW)
- **File:** `src/renderer.js:22-51`
- **Issue:** `getBalances()` iterates all entries each time
- **Risk:** O(n) performance per render
- **Fix:** Cache computed balances, invalidate on mutation

## Missing Features (User-Identified)

1. **No PostgreSQL** — Data only persists locally, no multi-device sync
2. **No Android APK** — No mobile access to stock data
3. **No PIN management UI** — Hardcoded PIN, no user creation flow
4. **No API for write operations** — `/api/stock` is read-only
5. **No category grouping in API** — Mobile needs categorized output
