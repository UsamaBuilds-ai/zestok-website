const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");
require("./server.js");

const createStore = async () => {
  const filePath = path.join(app.getPath("userData"), "stock-data.json");

  const read = async () => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Failed to read stock data:", error);
      }
      return { entries: [] };
    }
  };

  const write = async (data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  };

  return { read, write };
};

let store;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "Stock Management",
    backgroundColor: "#07172e",
    icon: path.join(__dirname, "..", "Icons", "ico.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
};

app.whenReady().then(async () => {
  store = await createStore();
  createWindow();

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

ipcMain.handle("stock:load", async () => store.read());

ipcMain.handle("stock:save", async (_event, payload) => {
  await store.write(payload);
  return payload;
});

ipcMain.handle("stock:export-report-pdf", async (_event, payload) => {
  const htmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${payload.title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      p { margin-top: 0; color: #4b5563; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
      th { background: #f3f4f6; }
      tbody tr:nth-child(even) { background: #fafafa; }
    </style>
  </head>
  <body>
    <h1>${payload.title}</h1>
    <p>${payload.subtitle}</p>
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
                <td>${escapeHtml(String(entry.quantity))}</td>
                <td>${escapeHtml(String(entry.rate))}</td>
                <td>${escapeHtml(String(entry.quantity * entry.rate))}</td>
                <td>${escapeHtml(entry.note || "-")}</td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </body>
</html>`;

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: false
    }
  });

  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlTemplate)}`);

  const pdfData = await pdfWindow.webContents.printToPDF({ printBackground: true, pageSize: "A4" });
  const fileName = `stock-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  const filePath = path.join(app.getPath("documents"), fileName);
  await fs.writeFile(filePath, pdfData);
  pdfWindow.close();

  return filePath;
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
