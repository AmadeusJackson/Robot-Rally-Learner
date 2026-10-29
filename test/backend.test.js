"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const AdmZip = require("adm-zip");
const { parsePptx, readPresentation } = require("../src/extraction");
const { createStore } = require("../src/persistence");
function fixture() {
  const zip = new AdmZip();
  const add = (name, text) => zip.addFile(name, Buffer.from(text));
  add(
    "ppt/presentation.xml",
    '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>',
  );
  add(
    "ppt/_rels/presentation.xml.rels",
    '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>',
  );
  add(
    "ppt/slides/slide1.xml",
    '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Last</a:t></a:r></a:p></p:sld>',
  );
  add(
    "ppt/slides/slide2.xml",
    '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Motor &amp; </a:t></a:r><a:r><a:t>gear</a:t></a:r></a:p><a:tbl><a:tr><a:tc><a:p><a:r><a:t>Voltage</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>12 V</a:t></a:r></a:p></a:tc></a:tr></a:tbl></p:sld>',
  );
  add(
    "ppt/slides/_rels/slide2.xml.rels",
    '<Relationships><Relationship Id="n" Type="x/notesSlide" Target="../notesSlides/notesSlide1.xml"/><Relationship Id="i" Type="x/image" Target="../media/image1.png"/></Relationships>',
  );
  add(
    "ppt/notesSlides/notesSlide1.xml",
    "<notes><p><t>Speaker explanation</t></p></notes>",
  );
  zip.addFile("ppt/media/image1.png", Buffer.from([137, 80, 78, 71]));
  return zip;
}
test("extracts presentation relationship order, rich text, notes, tables, and images", () => {
  const slides = parsePptx(fixture().toBuffer());
  assert.equal(slides.length, 2);
  assert.equal(slides[0].number, 1);
  assert.equal(slides[0].lines[0], "Motor & gear");
  assert.equal(slides[1].text, "Last");
  assert.equal(slides[0].notes, "Speaker explanation");
  assert.deepEqual(slides[0].tables, [[["Voltage", "12 V"]]]);
  assert.match(slides[0].images[0].dataUrl, /^data:image\/png;base64,/);
});
test("rejects invalid archives and unsafe XML declarations", () => {
  assert.throws(() => parsePptx(Buffer.from("not zip")));
  const zip = fixture();
  zip.updateFile(
    "ppt/slides/slide1.xml",
    Buffer.from('<!DOCTYPE x [<!ENTITY y "bad">]><x/>'),
  );
  assert.throws(() => parsePptx(zip.toBuffer()), /unsafe/);
});
test("rejects unsupported file formats", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rr-test-"));
  try {
    const file = path.join(temp, "a.txt");
    await fs.writeFile(file, "x");
    await assert.rejects(readPresentation(file), /pptx/);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
test("atomic store preserves settings and resume data across restart and serializes writes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rr-store-"));
  try {
    const store = createStore(dir, { speed: 250 });
    const initial = await store.load();
    assert.equal(initial.settings.speed, 250);
    const state = {
      ...initial,
      session: { levelIndex: 2, score: 350 },
      results: [{ score: 200 }],
    };
    await Promise.all([store.save(initial), store.save(state)]);
    assert.deepEqual(await createStore(dir).load(), state);
    await fs.writeFile(store.file, "broken");
    await assert.rejects(store.load(), /preserved/);
    assert.equal(await fs.readFile(store.file, "utf8"), "broken");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("preserves numeric strings and resolves root relationships independent of attribute order", () => {
  const zip = fixture();
  zip.updateFile(
    "ppt/presentation.xml",
    Buffer.from(
      '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="rId1" id="256"/></p:sldIdLst></p:presentation>',
    ),
  );
  zip.updateFile(
    "ppt/_rels/presentation.xml.rels",
    Buffer.from(
      '<Relationships><Relationship Id="rId1" Target="/ppt/slides/slide1.xml"/></Relationships>',
    ),
  );
  zip.updateFile(
    "ppt/slides/slide1.xml",
    Buffer.from(
      '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>00123</a:t></a:r></a:p></p:sld>',
    ),
  );
  assert.equal(parsePptx(zip.toBuffer())[0].text, "00123");
});
test("rejects broken explicit slide order instead of silently inventing a replacement", () => {
  const zip = fixture();
  zip.updateFile(
    "ppt/_rels/presentation.xml.rels",
    Buffer.from("<Relationships/>"),
  );
  assert.throws(() => parsePptx(zip.toBuffer()), /missing slide relationship/);
});
const { endpoint, localFetch } = require("../src/ollama");
test("Ollama stays local and disallows credentials, paths and redirects", async () => {
  assert.equal(endpoint("http://localhost:11434"), "http://localhost:11434");
  for (const value of [
    "https://example.com",
    "http://127.0.0.1.evil.com",
    "http://user:pass@localhost",
    "http://localhost/admin",
    "file:///tmp/model",
  ])
    assert.throws(() => endpoint(value));
  const original = global.fetch;
  try {
    global.fetch = async (_url, options) => {
      assert.equal(options.redirect, "error");
      return new Response("bad", { status: 503 });
    };
    await assert.rejects(
      localFetch("http://localhost:11434", "/api/tags"),
      /503/,
    );
    global.fetch = async () => new Response("invalid JSON");
    await assert.rejects(
      localFetch("http://localhost:11434", "/api/tags"),
      SyntaxError,
    );
  } finally {
    global.fetch = original;
  }
});
const {
  settingsCheck,
  decksCheck,
  validateState,
} = require("../src/state-validation");
test("state settings reject non-finite values and fractional counts", () => {
  for (const values of [
    { speed: NaN },
    { speed: Infinity },
    { levelCount: 1.5 },
    { deadZone: -1 },
    { endpoint: "http://example.com" },
    null,
    [],
  ])
    assert.throws(() => settingsCheck(values));
  assert.equal(settingsCheck({ deadZone: 0.23 }).deadZone, 0.23);
});
test("library validation rejects duplicate identifiers and invalid line payloads", () => {
  const d = {
    id: "d",
    name: "Deck",
    slides: [{ number: 1, text: "valid", lines: ["valid"] }],
  };
  assert.throws(() => decksCheck([d, d]), /duplicate/);
  assert.throws(
    () =>
      decksCheck([{ ...d, slides: [{ number: 1, text: "bad", lines: [{}] }] }]),
    /slide/,
  );
  assert.throws(
    () =>
      validateState({
        version: 1,
        decks: [],
        levels: [],
        results: [],
        settings: {},
        session: { levelIndex: 7 },
      }),
    /session/,
  );
});
test("store validates saved data on restart and preserves the previous file after rejected writes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rr-validated-"));
  try {
    const store = createStore(dir, {}, validateState);
    const state = {
      version: 1,
      decks: [],
      levels: [],
      results: [],
      settings: settingsCheck({}),
      session: null,
    };
    await store.save(state);
    assert.throws(() => store.save({ ...state, settings: { speed: NaN } }));
    assert.deepEqual(await store.load(), state);
    await fs.writeFile(
      store.file,
      JSON.stringify({ ...state, session: { levelIndex: 99 } }),
    );
    await assert.rejects(store.load(), /preserved/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
