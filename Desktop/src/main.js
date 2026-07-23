require('dotenv').config();
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const http = require("http");
const os = require("os");
const { app, BrowserWindow, ipcMain } = require("electron");

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  app.quit();
  process.exit(1);
});

const path = require("path");
const fs = require("fs/promises");
const { autoUpdater } = require("electron-updater");
const { API_URL } = require("./config.js");

const PIN_FILE = "stock-pin.json";
const DATA_FILE = "stock-data.json";
const CONFIG_FILE = "app-config.json";

const createPinStore = () => {
  const filePath = path.join(app.getPath("userData"), PIN_FILE);

  const read = async () => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  };

  const write = async (data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data), "utf8");
  };

  return { read, write };
};

const createDataFile = () => {
  const filePath = path.join(app.getPath("userData"), DATA_FILE);

  const read = async () => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch {
      return { entries: [] };
    }
  };

  const write = async (data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  };

  return { read, write };
};

const createConfigStore = () => {
  const filePath = path.join(app.getPath("userData"), CONFIG_FILE);

  const read = async () => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch {
      return { apiUrl: API_URL, deviceToken: null, companyName: "" };
    }
  };

  const write = async (data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  };

  return { read, write };
};

let pinStore;
let dataStore;
let configStore;
let mainWindow;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "Zestok",
    backgroundColor: "#07172e",
    icon: path.join(__dirname, "..", "Icons", "zestok.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
};

autoUpdater.on("checking-for-update", () => {
  mainWindow?.webContents.send("update:checking");
});

autoUpdater.on("update-available", (info) => {
  mainWindow?.webContents.send("update:available", info);
});

autoUpdater.on("update-not-available", (info) => {
  mainWindow?.webContents.send("update:not-available", info);
});

autoUpdater.on("download-progress", (progress) => {
  mainWindow?.webContents.send("update:download-progress", progress);
});

autoUpdater.on("update-downloaded", (info) => {
  mainWindow?.webContents.send("update:downloaded", info);
});

autoUpdater.on("error", (error) => {
  mainWindow?.webContents.send("update:error", error?.message || "Unknown error");
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  pinStore = createPinStore();
  dataStore = createDataFile();
  configStore = createConfigStore();

  ipcMain.handle("config:get-api-url", () => API_URL);
  ipcMain.handle("config:get", async () => {
    return await configStore.read();
  });
  ipcMain.handle("config:save", async (_event, data) => {
    const current = await configStore.read();
    await configStore.write({ ...current, ...data });
    return true;
  });

  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("network:local-ips", () => {
    const ips = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  });
  ipcMain.handle("license:save", async (_event, key) => {
    const cfg = await configStore.read();
    await configStore.write({ ...cfg, licenseKey: key });
    return true;
  });
  ipcMain.handle("license:load", async () => {
    const cfg = await configStore.read();
    return cfg.licenseKey || null;
  });
  ipcMain.handle("device:fingerprint", async () => {
    try {
      const network = os.networkInterfaces();
      let mac = 'unknown';
      for (const name of Object.keys(network)) {
        const iface = network[name].find(i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00');
        if (iface) { mac = iface.mac; break; }
      }
      const hostname = os.hostname();
      const hash = crypto.createHash('sha256').update(`${mac}|${hostname}`).digest('hex');
      return hash;
    } catch { return crypto.randomBytes(32).toString('hex'); }
  });

  ipcMain.handle("license:validate-server", async (_event, licenseKey) => {
    const CLOUD_API = process.env.CLOUD_API || 'https://tender-solace-production-5226.up.railway.app/api';
    try {
      const res = await fetch(`${CLOUD_API}/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      });
      if (res.ok) return await res.json();
      return { valid: false, reason: 'server_error' };
    } catch { return { valid: false, reason: 'offline' }; }
  });

  ipcMain.handle("update:check", () => autoUpdater.checkForUpdates());
  ipcMain.handle("update:download", () => autoUpdater.downloadUpdate());
  ipcMain.handle("update:install", () => autoUpdater.quitAndInstall());

  createWindow();

  const apiApp = require('./server');

  const { initDatabase, setDb } = require('./db/local');
  const dbPath = path.join(app.getPath('userData'), 'stock.db');
  db = await initDatabase(dbPath);
  setDb(db);
  console.log('Using local SQLite database');

  const serverPort = parseInt(process.env.API_PORT, 10) || 3000;
  const httpServer = http.createServer(apiApp);
  httpServer.listen(serverPort, '0.0.0.0', () => {
    console.log('API server running on port ' + serverPort);
  });
  httpServer.on('error', (err) => {
    console.error('API server error:', err.message);
  });

  app.on('will-quit', () => {
    httpServer.close();
    db.close();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("pin:save-local", async (_event, data) => {
  try {
    const hash = await bcrypt.hash(data.pin, 10);
    await pinStore.write({ pin_hash: hash, tenant_id: data.tenant_id, company_name: data.company_name || "" });
    return true;
  } catch (err) {
    console.error("pin:save-local failed:", err);
    throw err;
  }
});

ipcMain.handle("pin:load-local", async () => {
  try {
    return await pinStore.read();
  } catch (err) {
    console.error("pin:load-local failed:", err);
    return null;
  }
});

ipcMain.handle("pin:clear-local", async () => {
  await pinStore.write(null);
  return true;
});

ipcMain.handle("pin:status", async () => {
  const localPin = await pinStore.read();
  return { configured: !!(localPin && (localPin.pin_hash || localPin.configured)) };
});

ipcMain.handle("pin:mark-configured", async () => {
  const existing = await pinStore.read();
  if (!existing || !existing.pin_hash) {
    await pinStore.write({ configured: true, company_name: existing?.company_name || '' });
  }
  return true;
});

ipcMain.handle("pin:verify", async (_event, pin) => {
  if (!pin) return { valid: false };
  const stored = await pinStore.read();
  const valid = stored && stored.pin_hash ? await bcrypt.compare(pin, stored.pin_hash) : false;
  return { valid };
});

ipcMain.handle("data:load-local", async () => {
  return await dataStore.read();
});

ipcMain.handle("data:save-local", async (_event, data) => {
  await dataStore.write(data);
  return true;
});

app.on("before-quit", async () => {
  if (mainWindow) {
    try {
      await mainWindow.webContents.executeJavaScript("window.__saveBeforeQuit && window.__saveBeforeQuit()");
    } catch {}
  }
});

ipcMain.handle("stock:export-report-pdf", async (_event, payload) => {
  const escapeHtml = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formatAmt = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? "Rs " + num.toLocaleString("en-PK") : "Rs 0";
  };

  const totalAmt = payload.rows.reduce((sum, entry) => {
    const qty = Number(entry.quantity) || 0;
    const rate = Number(entry.rate) || 0;
    return sum + qty * rate;
  }, 0);

  const htmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(payload.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      p { margin-top: 0; color: #4b5563; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
      th { background: #f3f4f6; }
      tbody tr:nth-child(even) { background: #fafafa; }
      tfoot td { background: #f0f6ff; font-weight: 700; border-top: 2px solid #0d65d9; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(payload.title)}</h1>
    <p>${escapeHtml(payload.subtitle)}</p>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Item</th>
          <th>Category</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        ${payload.rows
          .map(
            (entry) => `
              <tr>
                <td>${escapeHtml(entry.date)}</td>
                <td>${escapeHtml(entry.type)}</td>
                <td>${escapeHtml(entry.item)}</td>
                <td>${escapeHtml(entry.category || "-")}</td>
                <td>${escapeHtml(formatAmt(entry.quantity))}</td>
                <td>${escapeHtml(formatAmt(entry.rate))}</td>
                <td>${escapeHtml(formatAmt(entry.quantity * entry.rate))}</td>
                <td>${escapeHtml(entry.note || "-")}</td>
              </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>Total</strong></td>
          <td></td>
          <td></td>
          <td><strong>${escapeHtml(formatAmt(totalAmt))}</strong></td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </body>
</html>`;

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true
    }
  });

  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlTemplate)}`);

  const pdfData = await pdfWindow.webContents.printToPDF({ printBackground: true, pageSize: "A4" });
  pdfWindow.close();

  const label = payload.searchValue
    ? payload.searchValue.replace(/\s+/g, '-')
    : (payload.filterType !== "all" ? payload.filterType : "all");
  const fileName = `zestok-report-${label}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const filePath = path.join(app.getPath("documents"), fileName);
  await fs.writeFile(filePath, pdfData);
  return filePath;
});

ipcMain.handle("data:reset-all", async () => {
  const userData = app.getPath("userData");
  const files = ["stock-pin.json", "stock-data.json", "app-config.json"];
  for (const file of files) {
    try {
      await fs.unlink(path.join(userData, file));
    } catch {}
  }
  try {
    await fs.unlink(path.join(userData, "stock.db"));
  } catch {}
  return true;
});
