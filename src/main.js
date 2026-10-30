"use strict";
const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { Worker } = require("node:worker_threads");
const { createStore } = require("./persistence");
const content = require("./content");
const fileAccess = require("./file-access").createFileAccess();
let win, store;
const indexURL = pathToFileURL(path.join(__dirname, "index.html")).href;
if (process.env.ROBOT_RALLY_USER_DATA)
  app.setPath("userData", process.env.ROBOT_RALLY_USER_DATA);
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      event.sender !== win?.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== indexURL
    )
      throw Error("Untrusted request.");
    return fn(...args);
  });
}
const {
  decksCheck,
  settingsCheck,
  validateState,
} = require("./state-validation");
const appleAI = require("./apple-ai");
const { generateAppleLevels } = require("./apple-generation");
function extract(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "extraction-worker.js"), {
      workerData: file,
      resourceLimits: { maxOldGenerationSizeMb: 384 },
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Error("Import timed out after two minutes."));
    }, 120000);
    worker.once("message", (result) => {
      clearTimeout(timer);
      worker.terminate();
      result.error ? reject(Error(result.error)) : resolve(result.slides);
    });
    worker.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    worker.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(Error("Presentation import worker stopped."));
    });
  });
}
function validLevels(levels, decks) {
  const result = content.validateLevels(levels, decks);
  if (!result.valid) throw Error(result.errors.join("\n"));
}
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 480,
    minHeight: 480,
    backgroundColor: "#0b1322",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== indexURL) event.preventDefault();
  });
  win.loadURL(indexURL);
}
app.whenReady().then(() => {
  store = createStore(
    app.getPath("userData"),
    content.DEFAULT_SETTINGS,
    validateState,
  );
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  handle("load-state", () => store.load());
  handle("save-state", (state) => store.save(validateState(state)));
  let importing = false;
  async function importFiles(paths, allowOutsideRoots = false) {
    if (
      !Array.isArray(paths) ||
      !paths.length ||
      paths.length > 20 ||
      paths.some((file) => typeof file !== "string")
    )
      throw Error("Choose between 1 and 20 presentation files.");
    const decks = [];
    const seen = new Set();
    for (const file of paths) {
      try {
        const resolved = await fileAccess.validatePresentationPath(file, {
          allowOutsideRoots,
        });
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        const slides = await extract(resolved);
        decks.push({
          id: randomUUID(),
          name: path.basename(file),
          slides,
          slideCount: slides.length,
        });
      } catch (error) {
        decks.push({ name: path.basename(file), error: error.message });
      }
    }
    return decks;
  }
  handle("list-presentation-files", (file) =>
    fileAccess.listPresentationFiles(file),
  );
  handle("import-presentation-paths", async (paths) => {
    if (importing) throw Error("An import is already running.");
    importing = true;
    try {
      return await importFiles(paths);
    } finally {
      importing = false;
    }
  });
  handle("select-presentations", async () => {
    if (importing) throw Error("An import is already running.");
    importing = true;
    try {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "PowerPoint", extensions: ["pptx", "ppt"] }],
      });
      if (result.canceled) return [];
      // The OS picker grants explicit user selection outside the controller browser roots.
      return await importFiles(result.filePaths, true);
    } finally {
      importing = false;
    }
  });
  handle("check-apple-ai", () => appleAI.checkAppleAI());
  handle("validate-levels", ({ levels, decks }) => {
    decksCheck(decks);
    return content.validateLevels(levels, decks);
  });
  handle("generate-offline", ({ decks, settings }) => {
    decksCheck(decks);
    return content.generateOffline(decks, settingsCheck(settings));
  });
  let generating = false;
  handle("generate-apple", async ({ decks, settings }) => {
    if (generating) throw Error("Generation is already in progress.");
    generating = true;
    try {
      return await generateAppleLevels(decks, settings, appleAI);
    } finally {
      generating = false;
    }
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
