const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  deadZone,
  collides,
  scorePickup,
  advanceProgress,
} = require("../src/game-core");
test("analog input suppresses drift and preserves proportional diagonal movement", () => {
  assert.deepEqual(deadZone(0.1, 0.1, 0.2), { x: 0, y: 0 });
  const p = deadZone(0.6, 0.6, 0.2);
  assert.equal(p.x, p.y);
  assert.ok(Math.hypot(p.x, p.y) < 1);
  assert.equal(Math.hypot(...Object.values(deadZone(1, 1, 0.2))), 1);
  assert.deepEqual(deadZone(NaN, undefined), { x: 0, y: 0 });
});
test("circle rectangle collision does not collect outside rounded corner distance", () => {
  assert.equal(
    collides({ x: 0, y: 0, radius: 18 }, { x: 120, y: 0, w: 220, h: 64 }),
    true,
  );
  assert.equal(
    collides({ x: 0, y: 0, radius: 18 }, { x: 128, y: 50, w: 220, h: 64 }),
    false,
  );
  assert.equal(collides({ x: 0, y: 0 }, { x: 0, y: 0 }), true);
});
test("scoring increments combo and applies penalty resetting streak", () => {
  const settings = { reward: 100, penalty: 50, comboBonus: 10 };
  assert.deepEqual(scorePickup(100, 2, true, settings), {
    score: 220,
    combo: 3,
    delta: 120,
  });
  assert.deepEqual(scorePickup(100, 2, false, settings), {
    score: 50,
    combo: 0,
    delta: -50,
  });
  assert.equal(scorePickup(0, 100, true, settings).delta, 200);
});
test("progress moves through questions, levels and terminates exactly once", () => {
  const levels = [{ questions: [{}, {}] }, { questions: [{}] }];
  assert.deepEqual(advanceProgress(levels, 0, 0), {
    levelIndex: 0,
    questionIndex: 1,
    complete: false,
  });
  assert.deepEqual(advanceProgress(levels, 0, 1), {
    levelIndex: 1,
    questionIndex: 0,
    complete: false,
  });
  assert.deepEqual(advanceProgress(levels, 1, 0), {
    levelIndex: 1,
    questionIndex: 0,
    complete: true,
  });
});
