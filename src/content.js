"use strict";
const DEFAULT_SETTINGS = Object.freeze({
  levelCount: 3,
  questionsPerLevel: 2,
  difficulty: "easy",
  distractors: 3,
  timeLimit: 0,
  reward: 100,
  penalty: 50,
  comboBonus: 10,
  speed: 250,
  hints: true,
  ordered: true,
  deadZone: 0.19,
  endpoint: "http://127.0.0.1:11434",
  model: "",
});
const TYPES = [
  "concept",
  "ordered",
  "cause-effect",
  "matching",
  "incorrect",
  "troubleshooting",
];
const str = { type: "string", minLength: 1, maxLength: 2000 };
const CHALLENGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "type",
    "title",
    "prompt",
    "choices",
    "correctIds",
    "ordered",
    "explanation",
    "source",
  ],
  properties: {
    id: str,
    type: { enum: TYPES },
    title: str,
    prompt: str,
    choices: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text"],
        properties: { id: str, text: str },
      },
    },
    correctIds: {
      type: "array",
      minItems: 1,
      maxItems: 7,
      uniqueItems: true,
      items: str,
    },
    ordered: { type: "boolean" },
    explanation: str,
    source: {
      type: "object",
      additionalProperties: false,
      required: ["deckId", "slideNumber", "quote"],
      properties: {
        deckId: str,
        slideNumber: { type: "integer", minimum: 1 },
        quote: str,
      },
    },
  },
};
const LEVELS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["levels"],
  properties: {
    levels: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "questions"],
        properties: {
          id: str,
          title: str,
          questions: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            items: CHALLENGE_SCHEMA,
          },
        },
      },
    },
  },
};
const normalize = (s) =>
  String(s || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
function validateLevels(levels, decks) {
  const errors = [];
  const fail = (p, m) => errors.push(`${p}: ${m}`);
  const ids = new Set();
  if (!Array.isArray(levels) || levels.length < 1 || levels.length > 20)
    return { valid: false, errors: ["Provide 1–20 levels."] };
  const record = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);
  const only = (v, keys) =>
    record(v) && Object.keys(v).every((k) => keys.includes(k));
  const textOK = (v) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= 2000;
  for (const [li, l] of levels.entries()) {
    const p = `Level ${li + 1}`;
    if (
      !only(l, ["id", "title", "questions"]) ||
      !textOK(l.id) ||
      !textOK(l.title) ||
      !Array.isArray(l.questions) ||
      !l.questions.length ||
      l.questions.length > 20
    ) {
      fail(p, "Invalid level fields or question count");
      continue;
    }
    if (ids.has(l.id)) fail(p, "Duplicate ID");
    ids.add(l.id);
    for (const [qi, q] of l.questions.entries()) {
      const at = `${p}, question ${qi + 1}`;
      if (
        !only(q, [
          "id",
          "type",
          "title",
          "prompt",
          "choices",
          "correctIds",
          "ordered",
          "explanation",
          "source",
        ]) ||
        !["id", "title", "prompt", "explanation"].every((k) => textOK(q[k])) ||
        !TYPES.includes(q.type) ||
        typeof q.ordered !== "boolean"
      ) {
        fail(at, "Missing or invalid challenge fields");
        continue;
      }
      if (ids.has(q.id)) fail(at, "Duplicate ID");
      ids.add(q.id);
      if (
        !Array.isArray(q.choices) ||
        q.choices.length < 2 ||
        q.choices.length > 8 ||
        q.choices.some(
          (c) => !only(c, ["id", "text"]) || !textOK(c.id) || !textOK(c.text),
        )
      ) {
        fail(at, "Provide 2–8 valid choices");
        continue;
      }
      const choices = new Map(q.choices.map((c) => [c.id, c]));
      if (
        choices.size !== q.choices.length ||
        new Set(q.choices.map((c) => normalize(c.text))).size !==
          q.choices.length
      )
        fail(at, "Duplicate or contradictory answer labels");
      if (
        !Array.isArray(q.correctIds) ||
        !q.correctIds.length ||
        q.correctIds.length >= q.choices.length ||
        new Set(q.correctIds).size !== q.correctIds.length ||
        q.correctIds.some((id) => !choices.has(id))
      ) {
        fail(
          at,
          "Correct answers must be distinct existing choices, with at least one distractor",
        );
        continue;
      }
      if (
        ["concept", "matching", "incorrect", "troubleshooting"].includes(
          q.type,
        ) &&
        q.correctIds.length !== 1
      )
        fail(at, "This challenge type requires one unambiguous answer");
      if (
        ["ordered", "cause-effect"].includes(q.type) &&
        (!q.ordered || q.correctIds.length < 2)
      )
        fail(at, "Sequence challenges require at least two ordered answers");
      const source = q.source;
      if (
        !only(source, ["deckId", "slideNumber", "quote"]) ||
        !textOK(source.deckId) ||
        !Number.isInteger(source.slideNumber) ||
        source.slideNumber < 1
      ) {
        fail(at, "Invalid source reference");
        continue;
      }
      const deck =
        Array.isArray(decks) && decks.find((d) => d && d.id === source?.deckId);
      const slide =
        Array.isArray(deck?.slides) &&
        deck.slides.find((s) => s && s.number === source?.slideNumber);
      if (
        !slide ||
        !textOK(source?.quote) ||
        !Array.isArray(slide.lines) ||
        slide.lines.some((l) => typeof l !== "string")
      ) {
        fail(at, "Missing source slide or evidence quote");
        continue;
      }
      const corpus = normalize(
        [
          slide.text,
          ...(slide.lines || []),
          slide.notes || "",
          JSON.stringify(slide.tables || []),
        ].join(" "),
      );
      if (!corpus.includes(normalize(source.quote)))
        fail(at, "Evidence quote is absent from the cited slide");
      // Extractive answers provide a mechanical grounding check; semantic relations still require review.
      if (q.type !== "incorrect")
        for (const id of q.correctIds) {
          if (
            !normalize(source.quote).includes(normalize(choices.get(id).text))
          )
            fail(
              at,
              "Correct answer must appear verbatim in the evidence quote",
            );
        }
      if (q.type === "incorrect" && !q.explanation.includes(source.quote))
        fail(
          at,
          "Incorrect-statement challenges must quote the supporting correction in the explanation",
        );
    }
  }
  return { valid: errors.length === 0, errors };
}
function bounded(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.min(max, Math.max(min, Math.floor(n)))
    : fallback;
}
function generateOffline(decks, settings = {}) {
  const count = bounded(settings.levelCount, 1, 20, 3),
    per = bounded(settings.questionsPerLevel, 1, 20, 2),
    distractors = bounded(settings.distractors, 1, 7, 3);
  const pool = [];
  for (const d of decks || [])
    for (const s of d.slides || [])
      for (const line of s.lines || []) {
        const text = line.replace(/\s+/g, " ").trim();
        if (
          text.length >= 12 &&
          text.length <= 160 &&
          !pool.some((p) => normalize(p.text) === normalize(text))
        )
          pool.push({ text, deck: d, slide: s });
      }
  const questions = [];
  for (const item of pool) {
    const corpus = normalize(
      [item.slide.text, ...item.slide.lines, item.slide.notes || ""].join(" "),
    );
    const alternatives = pool
      .filter((p) => !corpus.includes(normalize(p.text)))
      .slice(0, distractors);
    if (alternatives.length < distractors) continue;
    const id = `extract-${questions.length + 1}`;
    questions.push({
      id,
      type: "concept",
      title: `Slide ${item.slide.number} recall`,
      prompt: `Which exact statement appears on slide ${item.slide.number} of “${item.deck.name}”?`,
      choices: [
        { id: "answer", text: item.text },
        ...alternatives.map((p, i) => ({ id: `option-${i}`, text: p.text })),
      ],
      correctIds: ["answer"],
      ordered: false,
      explanation: `This is a slide-recall exercise. The other statements are not on this slide; they are not being labeled false. Source: “${item.text}”`,
      source: {
        deckId: item.deck.id,
        slideNumber: item.slide.number,
        quote: item.text,
      },
    });
  }
  if (questions.length < count * per)
    throw Error(
      `Only ${questions.length} distinct extractive questions can be grounded with ${distractors} distractors. Reduce levels, questions, or distractors; import more slides; or author questions in the preview. Offline mode tests slide recall, not conceptual understanding.`,
    );
  const levels = Array.from({ length: count }, (_, i) => ({
    id: `level-${i + 1}`,
    title: `Recall mission ${i + 1}`,
    questions: questions.slice(i * per, (i + 1) * per),
  }));
  const checked = validateLevels(levels, decks);
  if (!checked.valid) throw Error(checked.errors.join("\n"));
  return levels;
}
module.exports = {
  DEFAULT_SETTINGS,
  TYPES,
  LEVELS_SCHEMA,
  validateLevels,
  generateOffline,
};
