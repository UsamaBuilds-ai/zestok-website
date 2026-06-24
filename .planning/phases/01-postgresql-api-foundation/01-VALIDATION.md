---
phase: 1
slug: postgresql-api-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (PostgreSQL setup + API endpoints) |
| **Config file** | none — Wave 0 installs dependencies |
| **Quick run command** | `node -e "require('./.env-check.js')"` (env file check) |
| **Full suite command** | Start desktop app, verify Express API returns real data |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Verify changed files are syntactically valid
- **After every plan wave:** Restart Express, hit `/api/stock` and `/api/pin/status`
- **Before `/gsd-verify-work`:** Full workflow must work end-to-end
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Verification | File Exists | Status |
|---------|------|------|-------------|-----------|-------------|-------------|--------|
| 01-01-01 | 1 | 1 | DB-01 | manual | PostgreSQL 16+ installed, `psql --version` | ✅ | ⬜ pending |
| 01-01-02 | 1 | 1 | DB-02 | manual | Schema applied, `\dt stock_entries` shows table | ✅ | ⬜ pending |
| 01-01-03 | 1 | 1 | DB-03 | manual | `\dt app_settings` shows table | ✅ | ⬜ pending |
| 01-01-04 | 1 | 1 | DB-04 | manual | `SELECT * FROM stock_balance` returns correct data | ✅ | ⬜ pending |
| 01-02-01 | 2 | 2 | API-01 | integration | Express starts, no DB connection errors | ✅ | ⬜ pending |
| 01-02-02 | 2 | 2 | API-02,03,06 | integration | `curl http://localhost:3000/api/stock` returns grouped JSON | ✅ | ⬜ pending |
| 01-02-03 | 2 | 2 | API-04 | integration | `curl -H "x-access-pin: 1234" http://localhost:3000/api/pin/verify` | ✅ | ⬜ pending |
| 01-02-04 | 2 | 2 | API-05 | integration | `curl http://localhost:3000/api/pin/status` returns `{configured:false}` | ✅ | ⬜ pending |
| 01-03-01 | 3 | 3 | DB-05 | integration | Migration script runs, entries appear in PostgreSQL | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` updated with: `pg`, `bcrypt`, `express-rate-limit`, `dotenv`
- [ ] `.env` file template created (`.env.example`)
- [ ] `src/db/pool.js` — connection pool singleton

*Existing infrastructure covers basic project setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PostgreSQL installation | DB-01 | Requires Windows environment with admin rights | Run `psql --version`, verify 16.x |
| Schema creation | DB-02, DB-03 | Requires running SQL scripts against actual PG instance | Connect via psql, `\dt`, `\d stock_entries` |
| JSON data migration | DB-05 | Requires actual stock-data.json file with data | Run migration script, compare counts |
| API endpoint responses | API-02-06 | Requires running Express server against live PG | Use curl or Postman to verify each endpoint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
