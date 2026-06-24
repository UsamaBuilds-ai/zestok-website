# Phase 1: User Setup Required — PostgreSQL

**Generated:** 2026-06-24
**Phase:** 01-postgresql-api-foundation
**Status:** Incomplete

Complete these items for the PostgreSQL database and Express API to function. The agent automated everything possible; these items require manual system administration.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `DB_HOST` | `localhost` (127.0.0.1) | `.env` (copy from `.env.example`) |
| [ ] | `DB_PORT` | `5432` (PostgreSQL default) | `.env` |
| [ ] | `DB_NAME` | `stock_db` — you must create this database | `.env` |
| [ ] | `DB_USER` | `postgres` (superuser created by installer) | `.env` |
| [ ] | `DB_PASSWORD` | The password you set during PostgreSQL installer | `.env` |

## Database Setup

- [ ] **Download and install PostgreSQL 16+**
  - URL: https://www.postgresql.org/download/windows/
  - Run the EDB PostgreSQL installer (accept default options)
  - Set a memorable postgres superuser password when prompted
  - Note: This installs both PostgreSQL server and pgAdmin 4

- [ ] **Create the stock_db database**
  - Open "SQL Shell (psql)" from Start Menu, or use pgAdmin 4
  - Run: `CREATE DATABASE stock_db;`
  - Verify: `\l` should list `stock_db` in the database list

## Application Configuration

- [ ] **Create .env from template**
  - Copy `.env.example` at project root to `.env`
  - Edit `.env`: set `DB_PASSWORD` to the password you chose during PostgreSQL installation

- [ ] **Apply database schema**
  ```bash
  psql -d stock_db -U postgres -f src/db/schema.sql
  ```
  (Enter your postgres password when prompted)

  Or using pgAdmin 4:
  1. Open pgAdmin 4
  2. Connect to your PostgreSQL server
  3. Right-click `stock_db` → Query Tool
  4. Open and run `src/db/schema.sql`

## Verification

After completing setup, verify with:

```bash
# Check tables exist
psql -d stock_db -U postgres -c '\dt'

# Should show:
#              List of relations
#  Schema |     Name      | Type  |  Owner
# --------+---------------+-------+---------
#  public | app_settings  | table | postgres
#  public | stock_entries | table | postgres

# Check view exists
psql -d stock_db -U postgres -c '\dv'

# Running tests (from project root with .env configured)
node --test tests/db/connection.test.js

# Starting the server
npm start

# Test endpoint
curl http://localhost:3000/api/pin/status
# Expected: {"configured":false}
```

---

**Once all items complete:** Mark status as "Complete" at top of file.
