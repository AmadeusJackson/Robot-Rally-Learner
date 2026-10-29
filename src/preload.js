"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "desktopAPI",
  Object.freeze({
    loadState: () => ipcRenderer.invoke("load-state"),
    saveState: (state) => ipcRenderer.invoke("save-state", state),
    selectPresentations: () => ipcRenderer.invoke("select-presentations"),
    checkOllama: (endpoint) => ipcRenderer.invoke("check-ollama", endpoint),
    generateOllama: (payload) => ipcRenderer.invoke("generate-ollama", payload),
    generateOffline: (payload) =>
      ipcRenderer.invoke("generate-offline", payload),
    validateLevels: (payload) => ipcRenderer.invoke("validate-levels", payload),
  }),
);
