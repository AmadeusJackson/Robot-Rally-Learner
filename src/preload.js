"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "desktopAPI",
  Object.freeze({
    loadState: () => ipcRenderer.invoke("load-state"),
    saveState: (state) => ipcRenderer.invoke("save-state", state),
    selectPresentations: () => ipcRenderer.invoke("select-presentations"),
    listPresentationFiles: (path) =>
      ipcRenderer.invoke("list-presentation-files", path),
    importPresentationPaths: (paths) =>
      ipcRenderer.invoke("import-presentation-paths", paths),
    onGenerationProgress: (callback) => {
      const listener = (_event, progress) => callback(progress);
      ipcRenderer.on("generation-progress", listener);
      return () => ipcRenderer.removeListener("generation-progress", listener);
    },
    checkLocalAI: () => ipcRenderer.invoke("check-local-ai"),
    generateLocal: (payload) => ipcRenderer.invoke("generate-local", payload),
    checkAppleAI: () => ipcRenderer.invoke("check-apple-ai"),
    generateApple: (payload) => ipcRenderer.invoke("generate-apple", payload),
    generateOffline: (payload) =>
      ipcRenderer.invoke("generate-offline", payload),
    validateLevels: (payload) => ipcRenderer.invoke("validate-levels", payload),
  }),
);
