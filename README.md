# Zestok — Inventory Management Suite

**Zestok** is a modern, self-hosted inventory management system with a **Windows desktop app**, **Android mobile companion**, and a **marketing website**. Track stock, manage entries, generate reports, and keep your data private — no cloud dependency, no subscription.

## Architecture

```
zestok/
├── Website/        # Marketing & customer portal (HTML/CSS/JS) — deployed to Vercel
├── Desktop/        # Electron desktop app (Windows .exe)
│   ├── src/        # Electron main process, renderer, preload
│   ├── backend/    # Express API server (Node.js + PostgreSQL)
│   ├── scripts/    # Build scripts
│   └── build/      # NSIS installer resources
├── Mobile/         # Capacitor Android app (APK)
│   ├── android/    # Android native project
│   ├── src/        # Web app source (Vite + vanilla JS)
│   └── dist/       # Built web assets
└── Builds/         # Release binaries (gitignored)
```

## Components

### Website
Marketing site, pricing, download, admin panel, and customer portal. Fully static HTML/CSS/JS.

### Desktop App (Electron)
Full-featured inventory management with:
- Dashboard with real-time metrics
- Stock entry with auto-complete
- Reports with CSV/PDF export
- PIN & TOTP 2FA security
- Local SQLite database
- Auto-updater (electron-updater + GitHub Releases)

### Mobile App (Capacitor / Android)
Read-only companion app that connects to the desktop server over LAN:
- Dashboard overview
- Rate check screen
- Stock table with search/filter
- PIN authentication

### Backend API (Express + PostgreSQL)
License management, customer portal API, email delivery via Gmail SMTP, admin panel.

## Download

| Platform | Format | Source |
|----------|--------|--------|
| Windows | `.exe` (NSIS installer) | [GitHub Releases](https://github.com/UsamaBuilds-ai/zestok/releases) |
| Android | `.apk` | [GitHub Releases](https://github.com/UsamaBuilds-ai/zestok/releases) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Website | HTML, CSS, JavaScript |
| Desktop | Electron, Node.js, Express |
| Mobile | Capacitor, Vite, vanilla JS |
| Backend | Node.js, Express, PostgreSQL |
| Database | SQLite (local) / PostgreSQL (server) |
| Auth | JWT, bcrypt, speakeasy (TOTP) |
| Updates | electron-updater + GitHub Releases |

## License

All rights reserved. Purchase required for commercial usage.

---

Built by **Usama** &middot; [usamsohail2000@gmail.com](mailto:usamsohail2000@gmail.com)
