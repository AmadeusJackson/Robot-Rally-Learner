(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameCore = factory();
})(globalThis, function () {
  "use strict";
  function deadZone(x, y, zone = 0.19) {
    x = Number.isFinite(x) ? x : 0;
    y = Number.isFinite(y) ? y : 0;
    zone = Math.max(0, Math.min(0.9, zone));
    const m = Math.hypot(x, y);
    if (m <= zone) return { x: 0, y: 0 };
    const k = Math.min(1, (m - zone) / (1 - zone)) / m;
    return { x: x * k, y: y * k };
  }
  function collides(bot, item) {
    const dx = Math.max(Math.abs(bot.x - item.x) - (item.w || 220) / 2, 0),
      dy = Math.max(Math.abs(bot.y - item.y) - (item.h || 64) / 2, 0);
    return dx * dx + dy * dy <= (bot.radius || 18) ** 2;
  }
  function scorePickup(score, combo, correct, s) {
    const delta = correct
      ? s.reward + Math.min(combo, 10) * s.comboBonus
      : -s.penalty;
    return { score: score + delta, combo: correct ? combo + 1 : 0, delta };
  }
  function advanceProgress(levels, levelIndex, questionIndex) {
    if (questionIndex + 1 < levels[levelIndex].questions.length)
      return { levelIndex, questionIndex: questionIndex + 1, complete: false };
    if (levelIndex + 1 < levels.length)
      return { levelIndex: levelIndex + 1, questionIndex: 0, complete: false };
    return { levelIndex, questionIndex, complete: true };
  }
  return { deadZone, collides, scorePickup, advanceProgress };
});
