"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createFileAccess } = require("../src/file-access");
async function fixture(run) {
  const temp = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "rr-browser-")),
  );
  const root = path.join(temp, "Downloads");
  await fs.mkdir(root);
  const api = createFileAccess({
    roots: [{ name: "Downloads", path: root }],
    maxEntries: 3,
  });
  try {
    await run({ temp, root, api });
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
test("browser lists supported files, hides hidden entries, sorts folders first and stops at root", async () =>
  fixture(async ({ root, api }) => {
    await fs.mkdir(path.join(root, "Z lessons"));
    await fs.writeFile(path.join(root, "B.pptx"), "presentation");
    await fs.writeFile(path.join(root, "A.PPT"), "presentation");
    await fs.writeFile(path.join(root, "ignore.txt"), "text");
    await fs.writeFile(path.join(root, ".secret.pptx"), "hidden");
    assert.equal((await api.listPresentationFiles()).entries[0].path, root);
    const listed = await api.listPresentationFiles(root);
    assert.equal(listed.parent, null);
    assert.deepEqual(
      listed.entries.map((e) => e.name),
      ["Z lessons", "A.PPT", "B.pptx"],
    );
    assert.equal(
      (await api.listPresentationFiles(path.join(root, "Z lessons"))).parent,
      root,
    );
    await fs.writeFile(path.join(root, "C.pptx"), "presentation");
    const bounded = await api.listPresentationFiles(root);
    assert.equal(bounded.entries.length, 3);
    assert.equal(bounded.truncated, true);
  }));
test("browser rejects traversal, outside paths and escaping symlinks", async () =>
  fixture(async ({ temp, root, api }) => {
    const outside = path.join(temp, "outside");
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, "private.pptx"), "outside");
    await fs.symlink(outside, path.join(root, "shortcut"));
    await fs.symlink(
      path.join(outside, "private.pptx"),
      path.join(root, "linked.pptx"),
    );
    for (const target of [
      outside,
      root + "/../outside",
      path.join(root, "shortcut"),
    ])
      await assert.rejects(api.listPresentationFiles(target));
    await assert.rejects(
      api.validatePresentationPath(path.join(root, "linked.pptx")),
      /outside/,
    );
    assert.equal((await api.listPresentationFiles(root)).entries.length, 0);
  }));
test("import validation canonicalizes in-root links and rejects non-presentations, folders, hidden files and missing files", async () =>
  fixture(async ({ root, api }) => {
    const file = path.join(root, "real.pptx");
    await fs.writeFile(file, "presentation");
    await fs.symlink(file, path.join(root, "alias.pptx"));
    assert.equal(
      await api.validatePresentationPath(path.join(root, "alias.pptx")),
      file,
    );
    await fs.writeFile(path.join(root, "text.txt"), "text");
    await fs.mkdir(path.join(root, "folder.pptx"));
    await fs.writeFile(path.join(root, ".hidden.pptx"), "hidden");
    for (const name of [
      "text.txt",
      "folder.pptx",
      ".hidden.pptx",
      "missing.pptx",
    ])
      await assert.rejects(api.validatePresentationPath(path.join(root, name)));
  }));
