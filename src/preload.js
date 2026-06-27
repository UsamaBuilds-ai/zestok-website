const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

contextBridge.exposeInMainWorld("stockApi", {
  exportReportPdf: (payload) => ipcRenderer.invoke("stock:export-report-pdf", payload),
  checkPinStatus: () => ipcRenderer.invoke("pin:status"),
  savePinLocal: (data) => ipcRenderer.invoke("pin:save-local", data),
  loadPinLocal: () => ipcRenderer.invoke("pin:load-local"),
  clearPinLocal: () => ipcRenderer.invoke("pin:clear-local"),
  loadDataLocal: () => ipcRenderer.invoke("data:load-local"),
  saveDataLocal: (data) => ipcRenderer.invoke("data:save-local", data),
  getVersion: () => pkg.version
});
