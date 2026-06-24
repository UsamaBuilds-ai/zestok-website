const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stockApi", {
  load: () => ipcRenderer.invoke("stock:load"),
  save: (payload) => ipcRenderer.invoke("stock:save", payload),
  exportReportPdf: (payload) => ipcRenderer.invoke("stock:export-report-pdf", payload)
});
