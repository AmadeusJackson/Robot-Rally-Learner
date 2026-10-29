"use strict";
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const EXTENSIONS = new Set([".ppt", ".pptx"]);
const within = (file, root) =>
  file === root || file.startsWith(root + path.sep);
function friendlyError(error) {
  if (["EACCES", "EPERM"].includes(error.code))
    return Error(
      "macOS has not allowed access to this folder. Allow Robot Rally Learning in System Settings → Privacy & Security → Files and Folders, or use the standard file picker.",
    );
  if (error.code === "ENOENT")
    return Error(
      "This file or folder is no longer available. Choose another folder or refresh the list.",
    );
  return error;
}
function createFileAccess(options = {}) {
  const roots = (
    options.roots ||
    ["Downloads", "Documents", "Desktop"].map((name) => ({
      name,
      path: path.join(os.homedir(), name),
    }))
  ).map((root) => ({ name: root.name, path: path.resolve(root.path) }));
  const maxEntries = options.maxEntries || 500;
  async function canonical(file, allowOutsideRoots = false) {
    if (
      typeof file !== "string" ||
      !path.isAbsolute(file) ||
      file.includes("\0") ||
      file.split(path.sep).includes("..")
    )
      throw Error("Choose a valid file or folder from the browser.");
    const absolute = path.resolve(file);
    if (
      !allowOutsideRoots &&
      !roots.some((root) => within(absolute, root.path))
    )
      throw Error("Browse within Downloads, Documents, or Desktop.");
    const resolved = await fs.realpath(absolute);
    if (!allowOutsideRoots) {
      const root = roots.find((root) => within(resolved, root.path));
      if (!root)
        throw Error(
          "This shortcut points outside Downloads, Documents, or Desktop.",
        );
      if (
        path
          .relative(root.path, resolved)
          .split(path.sep)
          .some((part) => part.startsWith("."))
      )
        throw Error(
          "Hidden files and folders are not available in this browser.",
        );
      const rootResolved = await fs.realpath(root.path);
      if (rootResolved !== root.path)
        throw Error(
          "This folder is a shortcut outside the supported browse locations. Use the standard file picker.",
        );
    }
    return resolved;
  }
  async function listPresentationFiles(file) {
    try {
      if (file === undefined || file === null || file === "")
        return {
          path: null,
          parent: null,
          entries: roots.map((root) => ({ ...root, isDirectory: true })),
          roots,
        };
      const directory = await canonical(file);
      if (!(await fs.stat(directory)).isDirectory())
        throw Error("Choose a folder to browse.");
      const entries = [];
      let scanned = 0,
        truncated = false;
      const stream = await fs.opendir(directory);
      for await (const entry of stream) {
        if (++scanned > 10000) {
          truncated = true;
          break;
        }
        if (entry.name.startsWith(".")) continue;
        if (
          !entry.isDirectory() &&
          !entry.isSymbolicLink() &&
          !EXTENSIONS.has(path.extname(entry.name).toLowerCase())
        )
          continue;
        try {
          const target = await canonical(path.join(directory, entry.name));
          const stat = await fs.stat(target);
          if (
            !stat.isDirectory() &&
            !(
              stat.isFile() &&
              EXTENSIONS.has(path.extname(target).toLowerCase())
            )
          )
            continue;
          entries.push({
            name: entry.name,
            path: target,
            isDirectory: stat.isDirectory(),
          });
        } catch (error) {
          // Broken links and links outside browse roots are not selectable.
          if (["EACCES", "EPERM"].includes(error.code)) throw error;
        }
      }
      entries.sort(
        (a, b) =>
          Number(b.isDirectory) - Number(a.isDirectory) ||
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
      );
      const root = roots.find((root) => within(directory, root.path));
      return {
        path: directory,
        parent: directory === root.path ? null : path.dirname(directory),
        entries: entries.slice(0, maxEntries),
        roots,
        truncated: truncated || entries.length > maxEntries,
      };
    } catch (error) {
      throw friendlyError(error);
    }
  }
  async function validatePresentationPath(
    file,
    { allowOutsideRoots = false } = {},
  ) {
    try {
      const resolved = await canonical(file, allowOutsideRoots);
      if (!EXTENSIONS.has(path.extname(resolved).toLowerCase()))
        throw Error("Choose a .pptx or .ppt presentation.");
      const stat = await fs.stat(resolved);
      if (!stat.isFile())
        throw Error("Choose a presentation file, not a folder.");
      if (stat.size > 80 * 1024 * 1024)
        throw Error("Presentation exceeds the 80 MB import limit.");
      return resolved;
    } catch (error) {
      throw friendlyError(error);
    }
  }
  return { listPresentationFiles, validatePresentationPath };
}
module.exports = { createFileAccess };
