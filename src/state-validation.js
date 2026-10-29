"use strict";
const { DEFAULT_SETTINGS, validateLevels } = require("./content");
const { endpoint } = require("./ollama");
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function decksCheck(decks) {
  if (!Array.isArray(decks) || decks.length > 100)
    throw Error("Invalid presentation library.");
  const ids = new Set();
  for (const d of decks) {
    if (
      !record(d) ||
      typeof d.id !== "string" ||
      !d.id ||
      d.id.length > 2000 ||
      ids.has(d.id) ||
      typeof d.name !== "string" ||
      d.name.length > 2000 ||
      !Array.isArray(d.slides) ||
      d.slides.length > 500
    )
      throw Error("Invalid or duplicate presentation.");
    ids.add(d.id);
    const numbers = new Set();
    for (const s of d.slides) {
      if (
        !record(s) ||
        !Number.isInteger(s.number) ||
        s.number < 1 ||
        numbers.has(s.number) ||
        typeof s.text !== "string" ||
        s.text.length > 1000000 ||
        !Array.isArray(s.lines) ||
        s.lines.length > 10000 ||
        s.lines.some((l) => typeof l !== "string" || l.length > 1000000) ||
        (s.notes !== undefined && typeof s.notes !== "string") ||
        (s.tables !== undefined && !Array.isArray(s.tables)) ||
        (s.images !== undefined &&
          (!Array.isArray(s.images) ||
            s.images.some(
              (i) =>
                !record(i) ||
                typeof i.name !== "string" ||
                typeof i.dataUrl !== "string" ||
                !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(
                  i.dataUrl,
                ),
            )))
      )
        throw Error("Invalid or duplicate slide.");
      numbers.add(s.number);
    }
  }
}
function settingsCheck(value = {}) {
  if (!record(value)) throw Error("Invalid game settings.");
  const settings = { ...DEFAULT_SETTINGS, ...value };
  const limits = {
    levelCount: [1, 20],
    questionsPerLevel: [1, 20],
    distractors: [1, 7],
    timeLimit: [0, 3600],
    reward: [0, 10000],
    penalty: [0, 10000],
    comboBonus: [0, 10000],
    speed: [50, 800],
    deadZone: [0, 0.9],
  };
  for (const [key, [min, max]] of Object.entries(limits))
    if (
      typeof settings[key] !== "number" ||
      !Number.isFinite(settings[key]) ||
      settings[key] < min ||
      settings[key] > max ||
      (key !== "deadZone" && !Number.isInteger(settings[key]))
    )
      throw Error(`Invalid setting: ${key}`);
  if (
    !["easy", "medium", "hard", "custom"].includes(settings.difficulty) ||
    typeof settings.hints !== "boolean" ||
    typeof settings.ordered !== "boolean" ||
    typeof settings.model !== "string" ||
    settings.model.length > 200
  )
    throw Error("Invalid game settings.");
  endpoint(settings.endpoint);
  return settings;
}
function validateState(state) {
  if (
    !record(state) ||
    state.version !== 1 ||
    !Array.isArray(state.results) ||
    state.results.length > 10000
  )
    throw Error("Invalid saved state.");
  decksCheck(state.decks);
  state.settings = settingsCheck(state.settings);
  if (!Array.isArray(state.levels)) throw Error("Invalid saved levels.");
  if (state.levels.length) {
    const check = validateLevels(state.levels, state.decks);
    if (!check.valid) throw Error(check.errors.join("\n"));
  }
  for (const r of state.results)
    if (
      !record(r) ||
      !Number.isFinite(r.score) ||
      !Number.isInteger(r.correct) ||
      r.correct < 0 ||
      !Number.isInteger(r.incorrect) ||
      r.incorrect < 0 ||
      !Array.isArray(r.mistakes) ||
      r.mistakes.some((m) => !record(m))
    )
      throw Error("Invalid saved result.");
  if (state.session !== null) {
    const s = state.session;
    if (
      !record(s) ||
      !Number.isInteger(s.levelIndex) ||
      s.levelIndex < 0 ||
      !Number.isInteger(s.questionIndex) ||
      s.questionIndex < 0 ||
      !state.levels[s.levelIndex]?.questions[s.questionIndex] ||
      !["score", "combo", "correct", "incorrect", "remaining"].every(
        (k) => typeof s[k] === "number" && Number.isFinite(s[k]),
      ) ||
      s.combo < 0 ||
      s.correct < 0 ||
      s.incorrect < 0 ||
      s.remaining < 0 ||
      !Array.isArray(s.mistakes) ||
      !Array.isArray(s.collected)
    )
      throw Error("Invalid saved session.");
    if (
      s.levelStart !== undefined &&
      (!record(s.levelStart) ||
        !["score", "correct", "incorrect", "mistakeCount"].every((key) =>
          Number.isFinite(s.levelStart[key]),
        ) ||
        !Number.isInteger(s.levelStart.mistakeCount) ||
        s.levelStart.mistakeCount < 0 ||
        s.levelStart.mistakeCount > s.mistakes.length)
    )
      throw Error("Invalid saved level checkpoint.");
    const correct =
      state.levels[s.levelIndex].questions[s.questionIndex].correctIds;
    if (
      new Set(s.collected).size !== s.collected.length ||
      s.collected.some((id) => !correct.includes(id))
    )
      throw Error("Invalid saved answer progress.");
  }
  return state;
}
module.exports = { decksCheck, settingsCheck, validateState };
