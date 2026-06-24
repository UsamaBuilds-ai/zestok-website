# Roadmap: Stock Management

## Phase 1: PostgreSQL + API Foundation
**Goal:** Setup PostgreSQL database, migrate Express API from mock data to real queries
**Mode:** mvp
**Success Criteria:**
1. PostgreSQL 16+ installed, database created, schema applied
2. Express `/api/stock` returns real stock data from PostgreSQL
3. API returns stock grouped by category, only available items
4. PIN verification endpoint works with configurable PIN
5. Existing JSON data migrated to PostgreSQL

## Phase 2: Desktop PostgreSQL Integration + PIN Management
**Goal:** Desktop app reads/writes from PostgreSQL, add PIN settings page
**Mode:** mvp
**Success Criteria:**
1. Desktop app loads data from PostgreSQL on startup
2. Desktop app saves new entries to PostgreSQL
3. Desktop has PIN settings tab (set/change PIN)
4. Desktop shows local IP for mobile connection
5. Express server auto-starts with the desktop app

## Phase 3: Android Mobile APK
**Goal:** Capacitor-based Android app for viewing stock on mobile
**Mode:** mvp
**Success Criteria:**
1. Capacitor project created in `mobile/` directory
2. PIN entry screen works on first launch
3. Stock list grouped by category, searchable
4. Each item shows name, category, qty, rate
5. Only available items displayed
6. APK builds and installs on Android device
