# Zestok Desktop App

Electron-based inventory management application for Windows.

## Features

- Dashboard with real-time stock metrics
- Stock entry/exit with auto-complete
- Reports & CSV/PDF export
- PIN authentication & TOTP 2FA
- Local SQLite database
- Auto-updater via GitHub Releases

## Requirements

- Node.js 18+
- npm

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

## Build Windows Installer

```bash
npm run build
```

## Project Structure

```
Desktop/
├── src/           # Electron app source (main, renderer, preload)
├── backend/       # Express API server (for license/customer portal)
├── scripts/       # Build scripts
├── build/         # NSIS installer resources
└── Icons/         # App icons (gitignored)
```

## Security Notes

- Do not commit `.env` files or credentials to Git
- Keystore files (`*.jks`) must stay outside the repository
- API keys and secrets go in environment variables only
