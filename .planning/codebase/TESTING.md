# Testing Patterns

**Analysis Date:** 2026-07-07

## Test Framework

**Runner:**
- Node.js built-in test runner (`node --test`)
- Configured in `package.json` as: `"test": "node --test"`
- No config file for test runner (e.g., no `.node-test.config` or similar)

**Assertion Library:**
- Node.js built-in `assert` module (assumed from `node --test` runner usage)
- No external assertion libraries detected

**HTTP Testing:**
- `supertest` v7.2.2 included in `devDependencies` of root `package.json`
- Located at: `D:\Stock Management\package.json`

**Run Commands:**
```bash
node --test              # Run all tests (from package.json: "test")
```

## Test File Organization

**Location:**
- **No test files found** — zero `*.test.*` or `*.spec.*` files exist in the repository
- No `__tests__/` directories found
- No `test/` directory found

**Naming:**
- No convention established (no test files to inspect)
- Recommended convention (per Node.js `node --test`): `*.test.js` or `*.spec.js` co-located with source or in a `test/` directory

**Structure:**
- No test structure exists to document
- Based on `package.json`, tests would be discovered automatically by `node --test` when test files exist

## Test Structure

**No existing test suites** — the project has no tests. Below is the inferred pattern based on the tech stack:

**Expected suite organization (based on `node --test` + `supertest`):**
```js
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/server');

describe('API /api/health', () => {
  it('should return ok when database is reachable', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });
});
```

## Mocking

**Framework:**
- No mocking framework detected (`sinon`, `jest.mock`, `testdouble`, etc.)
- Node.js built-in `mock` module (`node:test` has `mock` feature) could be used but no imports found

**Patterns:**
- No mocking patterns exist in the codebase
- The codebase uses patterns that *could* be mocked:
  - `fetch()` calls in renderer — could be mocked via global `fetch` override
  - `pg.Pool` in server — could be mocked with a test/pool replacement
  - `fs/promises` in main process — could be mocked with `mock.fs`

**What to Mock (recommended for this codebase):**
- PostgreSQL database (`pg.Pool`) for server tests
- `electron` / `ipcRenderer` for preload and main process tests
- `fetch()` for renderer tests
- File system operations for credential/config tests

**What NOT to Mock (recommended):**
- Business logic calculations (`getBalances`, `formatQty`, `escapeHtml`)
- Pure utility functions
- Express route definitions (test with supertest against real app)

## Fixtures and Factories

**No test fixtures exist** — no fixture files or test data factories found.

**Inferred pattern for test data (based on source code):**
```js
// Based on entry shape in src/renderer.js:668-678
const createEntry = (overrides = {}) => ({
  id: crypto.randomUUID(),
  date: '2026-07-07',
  type: 'in',
  item: 'Test Item',
  category: 'Test Category',
  quantity: 10,
  rate: 100,
  note: 'Test note',
  createdAt: new Date().toISOString(),
  ...overrides
});
```

**Recommended fixture locations:**
- Co-located with test files or in a shared `test/fixtures/` directory

## Coverage

**Requirements:** None detected — no coverage configuration or scripts in `package.json`

**View Coverage (not configured but could be run with):**
```bash
node --test --experimental-test-coverage
```

## Test Types

**Unit Tests:**
- Not present
- Recommended candidates: `escapeHtml()`, `formatQty()`, `formatRate()`, `getBalances()`, `validateEntry()`, slug functions, utility functions

**Integration Tests:**
- `supertest` dep suggests intent for HTTP integration tests
- Not present
- Recommended candidates: all `GET /api/*` and `POST /api/*` routes in `src/server.js`

**E2E Tests:**
- Not used
- No framework detected (no Playwright, Cypress, Puppeteer)

## Test Gap Summary

| Area | Test Coverage | Risk |
|------|--------------|------|
| `src/renderer.js` — DOM rendering, state, CRUD | **None** | High — 909 lines, core business logic |
| `src/server.js` — Express API, DB routes | **None** | High — 558 lines, authentication, data persistence |
| `src/main.js` — Electron IPC handlers | **None** | Medium — 341 lines, file I/O, PIN management |
| `src/db/pool.js` — DB pool management | **None** | Medium — connection lifecycle logic |
| `src/db/migrate.js` — Data migration | **None** | Low — one-time script |
| `src/credential.js` — Credential file ops | **None** | Low — thin wrapper over `fs` |
| `src/preload.js` — Context bridge | **None** | Low — thin IPC proxy |
| `src/config.js` — Env config | **None** | Low — 2 lines |

---

*Testing analysis: 2026-07-07*
