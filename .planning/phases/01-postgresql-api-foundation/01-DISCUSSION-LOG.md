# Phase 1: PostgreSQL + API Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 1-PostgreSQL + API Foundation
**Areas discussed:** DB Connection Config, PIN Bootstrapping, API Error Handling

---

## DB Connection Config

| Option | Description | Selected |
|--------|-------------|----------|
| `.env` file | Standard approach — .env file loaded via dotenv, .gitignore'd. Easy to manage, separates config from code. | ✓ |
| JSON config file | A config.json in the app data directory, alongside stock-data.json. Familiar pattern for this codebase. | |
| `app_settings` table | Store DB connection in the database itself (chicken-egg problem — need connection to read it) | |
| Manual download | User downloads from postgresql.org and runs installer. Detailed steps in setup instructions. | ✓ |
| Embedded/portable PG | Bundle a portable PostgreSQL distribution with the app. More complex but fully automated. | |
| Docker Desktop | User runs PostgreSQL via Docker. Requires Docker Desktop on Windows but clean setup/teardown. | |
| `stock_management` | Descriptive name matching project — obvious what it's for | |
| `stock_db` | Shorter, conventional prefix | ✓ |
| `sgm_db` | Short abbreviation — minimal typing | |

**User's choice:** `.env` file, Manual download + detailed setup docs, `stock_db`, port 5432 (default)
**Notes:** None

---

## PIN Bootstrapping

| Option | Description | Selected |
|--------|-------------|----------|
| `'not_configured'` state | Return `{ configured: false }`. API rejects all mobile requests until desktop sets PIN. | ✓ |
| Default PIN '1234' | Match current hardcoded behavior — works out of box but less secure. | |
| Hashed (bcrypt) | bcrypt hash stored in DB — secure, industry standard. | ✓ |
| Plain text | Simple but insecure. | |
| Desktop Phase 2 only | No default PIN. Desktop app provides PIN settings in Phase 2. | ✓ |
| Seed in data migration | Set a temporary PIN during Phase 1 JSON migration. | |
| Yes, add now | Add express-rate-limit in Phase 1. | ✓ |
| Defer to later | Only 1-2 mobile devices, low risk. | |

**User's choice:** `{ configured: false }`, bcrypt-hashed PIN, Desktop Phase 2 sets initial PIN, rate limiting added in Phase 1
**Notes:** None

---

## API Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| 500 + error JSON | HTTP 500 with error message. | |
| 503 + error JSON | HTTP 503 Service Unavailable — semantically correct | ✓ |
| Fallback to JSON file | Return cached data from JSON file as fallback. | |
| 401 + error | HTTP 401 Unauthorized | ✓ |
| 200 + valid: false | Always return 200, hide whether endpoint exists. | |
| 200 + configured: false | Return `{ configured: false, valid: false }`. Mobile shows appropriate message. | ✓ |
| 412 Precondition Failed | HTTP 412 — semantically correct but unusual. | |
| 400 + details | HTTP 400 with specific validation error message. | ✓ |
| 500 + generic | Don't leak schema details. | |

**User's choice:** PG down = 503, wrong PIN = 401, no PIN configured = 200 `{configured: false, valid: false}`, validation errors = 400 with details
**Notes:** None

---

## Agent's Discretion

None — all decisions explicitly chosen by user.

## Deferred Ideas

None.
