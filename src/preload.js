const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stockApi", {
  getApiUrl: () => ipcRenderer.invoke("config:get-api-url"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (data) => ipcRenderer.invoke("config:save", data),
  exportReportPdf: (payload) => ipcRenderer.invoke("stock:export-report-pdf", payload),
  checkPinStatus: () => ipcRenderer.invoke("pin:status"),
  markPinConfigured: () => ipcRenderer.invoke("pin:mark-configured"),
  savePinLocal: (data) => ipcRenderer.invoke("pin:save-local", data),
  loadPinLocal: () => ipcRenderer.invoke("pin:load-local"),
  clearPinLocal: () => ipcRenderer.invoke("pin:clear-local"),
  loadDataLocal: () => ipcRenderer.invoke("data:load-local"),
  saveDataLocal: (data) => ipcRenderer.invoke("data:save-local", data),
  verifyPin: (pin) => ipcRenderer.invoke("pin:verify", pin),
  getVersion: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateChecking: (cb) => { ipcRenderer.on("update:checking", cb); return () => ipcRenderer.removeListener("update:checking", cb); },
  onUpdateAvailable: (cb) => { ipcRenderer.on("update:available", (_e, info) => cb(info)); return () => ipcRenderer.removeListener("update:available", cb); },
  onUpdateNotAvailable: (cb) => { ipcRenderer.on("update:not-available", cb); return () => ipcRenderer.removeListener("update:not-available", cb); },
  onUpdateDownloadProgress: (cb) => { ipcRenderer.on("update:download-progress", (_e, p) => cb(p)); return () => ipcRenderer.removeListener("update:download-progress", cb); },
  onUpdateDownloaded: (cb) => { ipcRenderer.on("update:downloaded", (_e, info) => cb(info)); return () => ipcRenderer.removeListener("update:downloaded", cb); },
  onUpdateError: (cb) => { ipcRenderer.on("update:error", (_e, msg) => cb(msg)); return () => ipcRenderer.removeListener("update:error", cb); },
  resetAllData: () => ipcRenderer.invoke("data:reset-all")
});
