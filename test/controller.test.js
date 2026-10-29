const test = require("node:test");
const assert = require("node:assert/strict");
const { InputRepeater } = require("../src/controller-ui");
test("connecting or regaining focus with buttons held requires neutral before activation", () => {
  const r = new InputRepeater();
  assert.deepEqual(r.sample({ a: true, down: false }, 0), []);
  assert.deepEqual(r.sample({ a: true, down: false }, 600), []);
  assert.deepEqual(r.sample({ a: false, down: false }, 610), []);
  assert.deepEqual(r.sample({ a: true, down: false }, 620), ["a"]);
  r.reset();
  assert.deepEqual(r.sample({ a: true }, 630), []);
});
test("activation is edge-only, directional navigation repeats after delay", () => {
  const r = new InputRepeater();
  r.sample({ a: false, down: false }, 0);
  assert.deepEqual(r.sample({ a: true, down: true }, 10), ["a", "down"]);
  assert.deepEqual(r.sample({ a: true, down: true }, 300), []);
  assert.deepEqual(r.sample({ a: true, down: true }, 440), ["down"]);
  assert.deepEqual(r.sample({ a: true, down: true }, 500), []);
  assert.deepEqual(r.sample({ a: true, down: true }, 580), ["down"]);
  r.sample({ a: false, down: false }, 600);
  assert.deepEqual(r.sample({ a: true, down: false }, 610), ["a"]);
});
