# Zestok

**Website:** [https://zestock.vercel.app](https://zestock.vercel.app)

Zestok is a modern inventory management application built with Electron, Node.js, Express, and SQLite. It combines a desktop client with a backend API server and is intended for local use as well as self-hosted or cloud deployment. Track stock levels, manage entries and exits, and monitor your inventory from anywhere at [zestock.vercel.app](https://zestock.vercel.app).

## Features

- Electron-based desktop application for stock operations
- Tenant or company setup flow during initial configuration
- Local storage for app settings and device-specific configuration
- REST API backend for inventory workflows
- PostgreSQL-based data storage and tenant-aware server logic
- Windows installer build support via Electron Builder

## Project Structure

```text
.
├── build/                 # Windows installer resources
├── Icons/                 # App icons and assets
├── scripts/               # Helper scripts
├── server/                # Express API server
│   └── index.js
├── src/                   # Electron app source code
│   ├── db/                # Database migration and pool setup
│   ├── main.js            # Electron main process
│   ├── preload.js         # Preload bridge
│   ├── renderer.js        # Renderer logic
│   ├── server.js          # Express server implementation
│   ├── config.js          # API configuration
│   └── setup.html         # Setup UI
└── package.json           # Main app scripts and dependencies
```

## Requirements

- Node.js 18+
- npm
- PostgreSQL database
- Windows build tools for packaging the desktop installer

## Installation

```bash
npm install
```

## Database Setup

Run the database migration script:

```bash
npm run migrate
```

## Run the Application

Start the backend API server:

```bash
npm run server
```

Start the Electron desktop app:

```bash
npm start
```

## Build for Windows

Create a Windows installer package:

```bash
npm run build
```

## Configuration

- Update the API base URL in [src/config.js](src/config.js)
- Configure backend environment variables before starting the API service
- Keep secrets, API credentials, and database connection details out of source control

## Security Notes

- Do not commit environment files, API keys, or credentials to Git
- Store sensitive values in environment variables or secure local OS storage
- Use HTTPS/TLS and restricted network access in hosted deployments
- Review file permissions and access control for local data storage

## Notes

This repository contains two runtime layers:

1. Electron client app for the desktop interface
2. Express server for API and database communication

The project is suitable for inventory tracking, stock entry/exit logging, and deployment in a hosted environment.
