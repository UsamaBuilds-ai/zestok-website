# Features Research: Stock Management

**Date:** 2026-06-24

## Table Stakes (Must Have)

- **Stock item listing** — Display items with name, category, quantity, rate
- **Category grouping** — Items organized by category section headers
- **Search/filter** — Real-time text search across item names
- **Available stock only** — Filter out items with zero balance
- **PIN-based access** — Prevent unauthorized viewing of stock data
- **Real-time data** — Data reflects latest desktop entries via API

## Differentiators

- **Desktop + Mobile sync** — Single PostgreSQL database for both platforms
- **Configurable PIN** — Desktop admin sets the PIN, no account registration needed
- **View-optimized mobile UI** — Clean, focused read-only experience for field use
- **Local network deployment** — No cloud infrastructure required

## Anti-Features (Deliberately Not Building)

- User registration / accounts — Single PIN is simpler for small business
- Offline mode — Requires network to API server
- Push notifications — Not needed for view-only stock app
- Edit/delete from mobile — View-only is safer for data integrity
- Fancy animations — Performance > visual flare for stock data
