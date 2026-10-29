"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { pathToFileURL } = require("node:url");
const AdmZip = require("adm-zip");
const { XMLParser, XMLValidator } = require("fast-xml-parser");
const run = promisify(execFile);
const MAX_FILE = 80 * 1024 * 1024;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  processEntities: true,
  trimValues: false,
  parseTagValue: false,
});
const namespaceParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  processEntities: true,
  trimValues: false,
  parseTagValue: false,
});
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
function find(node, key) {
  const out = [];
  if (!node || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === key) out.push(...arr(v));
    else if (!k.startsWith("@"))
      for (const child of arr(v)) out.push(...find(child, key));
  }
  return out;
}
function textValue(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (node && typeof node === "object") return String(node["#text"] ?? "");
  return "";
}
function paragraphs(node) {
  return find(node, "p")
    .map((p) => find(p, "t").map(textValue).join("").trim())
    .filter(Boolean);
}
function parsePptx(input) {
  if (Buffer.isBuffer(input) && input.length > MAX_FILE)
    throw Error("Presentation exceeds the 80 MB import limit.");
  const zip = new AdmZip(input);
  const entries = zip.getEntries();
  if (
    entries.length > 10000 ||
    entries.reduce((n, e) => n + e.header.size, 0) > 200 * 1024 * 1024
  )
    throw Error("Presentation expands beyond the safe extraction limit.");
  function xml(name, preserveNamespace = false) {
    const e = zip.getEntry(name);
    if (!e) return null;
    if (e.header.size > 12 * 1024 * 1024)
      throw Error("An XML component is too large.");
    const s = e.getData().toString("utf8");
    if (/<!DOCTYPE|<!ENTITY/i.test(s) || XMLValidator.validate(s) !== true)
      throw Error("Invalid or unsafe presentation XML.");
    return (preserveNamespace ? namespaceParser : parser).parse(s);
  }
  function rels(name) {
    const file = path.posix.join(
      path.posix.dirname(name),
      "_rels",
      path.posix.basename(name) + ".rels",
    );
    return arr(xml(file)?.Relationships?.Relationship)
      .filter((r) => r["@TargetMode"] !== "External")
      .map((r) => ({
        ...r,
        target: path.posix.normalize(
          String(r["@Target"] || "").startsWith("/")
            ? r["@Target"].slice(1)
            : path.posix.join(path.posix.dirname(name), r["@Target"] || ""),
        ),
      }));
  }
  const presentation = xml("ppt/presentation.xml", true);
  const pr = rels("ppt/presentation.xml");
  function localNodes(node, key) {
    const out = [];
    if (!node || typeof node !== "object") return out;
    for (const [k, v] of Object.entries(node)) {
      if (k.split(":").pop() === key) out.push(...arr(v));
      else if (!k.startsWith("@"))
        for (const child of arr(v)) out.push(...localNodes(child, key));
    }
    return out;
  }
  const ids = localNodes(presentation, "sldId");
  const order = ids.map((s) => {
    const ref = Object.entries(s).find(
      ([key]) =>
        key.startsWith("@") &&
        key.includes(":") &&
        key.split(":").pop() === "id",
    )?.[1];
    const target = pr.find((r) => r["@Id"] === ref)?.target;
    if (!target || !zip.getEntry(target))
      throw Error("Presentation references a missing slide relationship.");
    return target;
  });
  const names = order.length
    ? order
    : entries
        .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
        .map((e) => e.entryName)
        .sort(
          (a, b) =>
            Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]),
        );
  if (!names.length)
    throw Error("This file contains no readable PowerPoint slides.");
  if (names.length > 500)
    throw Error("Import up to 500 slides per presentation.");
  let imageBytes = 0;
  return names.map((name, index) => {
    const doc = xml(name);
    if (!doc) throw Error("Missing slide component.");
    const relationships = rels(name);
    const lines = paragraphs(doc);
    const titleLines = [];
    const bodyLines = [];
    for (const shape of find(doc, "sp")) {
      const placeholders = find(shape, "ph");
      const type = placeholders[0]?.["@type"];
      if (["title", "ctrTitle", "subTitle"].includes(type))
        titleLines.push(...paragraphs(shape));
      else if (!["dt", "ftr", "sldNum"].includes(type))
        bodyLines.push(...paragraphs(shape));
    }
    const isTitleSlide =
      index === 0 ||
      (titleLines.length > 0 &&
        bodyLines.length === 0 &&
        find(doc, "tbl").length === 0);

    const tables = find(doc, "tbl").map((t) =>
      arr(t.tr).map((row) =>
        arr(row.tc).map((cell) => paragraphs(cell).join("\n")),
      ),
    );
    const notes = relationships
      .filter((r) => String(r["@Type"]).endsWith("/notesSlide"))
      .flatMap((r) => paragraphs(xml(r.target)))
      .join("\n");
    // SmartArt stores its text in related diagram data rather than slide runs.
    for (const r of relationships.filter((r) =>
      String(r["@Type"]).endsWith("/diagramData"),
    ))
      lines.push(...paragraphs(xml(r.target)));
    const images = [];
    for (const r of relationships.filter((r) =>
      String(r["@Type"]).endsWith("/image"),
    )) {
      const e = zip.getEntry(r.target);
      const ext = path.posix.extname(r.target).toLowerCase();
      const mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
      }[ext];
      if (
        !e ||
        !mime ||
        e.header.size > 4 * 1024 * 1024 ||
        imageBytes + e.header.size > 20 * 1024 * 1024
      )
        continue;
      imageBytes += e.header.size;
      images.push({
        name: path.posix.basename(r.target),
        dataUrl: `data:${mime};base64,${e.getData().toString("base64")}`,
      });
    }
    return {
      number: index + 1,
      isTitleSlide,
      title: titleLines.join(" "),
      lines,
      text: lines.join("\n"),
      notes,
      tables,
      images,
    };
  });
}
async function readPresentation(file) {
  const stat = await fs.stat(file);
  if (stat.size > MAX_FILE)
    throw Error("Presentation exceeds the 80 MB import limit.");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pptx") return parsePptx(await fs.readFile(file));
  if (ext !== ".ppt") throw Error("Choose a .pptx or .ppt presentation.");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "robot-rally-"));
  try {
    const candidates =
      process.platform === "darwin"
        ? [
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
            "soffice",
            "libreoffice",
          ]
        : ["soffice", "libreoffice"];
    let converted = false;
    for (const cmd of candidates) {
      try {
        await run(
          cmd,
          [
            `-env:UserInstallation=${pathToFileURL(path.join(temp, "profile")).href}`,
            "--headless",
            "--convert-to",
            "pptx",
            "--outdir",
            temp,
            file,
          ],
          { timeout: 90000, maxBuffer: 1024 * 1024 },
        );
        converted = true;
        break;
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    if (!converted) throw Error("LibreOffice was not found.");
    const files = await fs.readdir(temp);
    const result = files.find((f) => f.endsWith(".pptx"));
    if (!result) throw Error("Conversion did not produce a PPTX.");
    return parsePptx(await fs.readFile(path.join(temp, result)));
  } catch (e) {
    throw Error(
      "Legacy .ppt import requires LibreOffice installed locally. Install LibreOffice in Applications or save this deck as .pptx. " +
        e.message,
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
module.exports = { parsePptx, readPresentation };
