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
// The opening slide is excluded even when a deck omits title placeholders.
// Other title-only slides use import metadata; legacy libraries use a conservative heading heuristic.
function isTopicOutline(lines) {
  const meaningful = lines
    .map((line) => line.trim())
    .filter((line) => line && !/^(?:<number>|\d+)$/i.test(line));
  const marker =
    /^(?:agenda|(?:table of )?contents|key concepts|topics(?: covered)?|outline)\s*[:–—-]?\s*$/i;
  if (!meaningful.some((line) => marker.test(line))) return false;
  const topics = meaningful.filter((line) => !marker.test(line));
  if (topics.length < 2) return false;
  // Keep teaching slides even when they use a "Key concepts" heading. A factual
  // sentence, explicit definition, or explanatory phrase is evidence of content.
  const factual =
    /\b(?:is|are|means|has|have|can|requires?|converts?|stores?|measures?|transmits?|produces?|controls?|uses?|obtains?|releases?|provides?|contains?|occurs?|consists?|depends?|involves?|forms?|transfers?|breaks?|combines?)\b|\b(?:process|mechanism|method) by which\b|:\s+\S|[.!?]$/i;
  return topics.every((line) => line.length < 160 && !factual.test(line));
}
function getEligibleSlides(decks) {
  const eligible = [];
  for (const deck of Array.isArray(decks) ? decks : []) {
    if (!deck || !Array.isArray(deck.slides)) continue;
    for (const [index, slide] of deck.slides.entries()) {
      if (
        !slide ||
        index === 0 ||
        slide.number === 1 ||
        slide.isTitleSlide === true
      )
        continue;
      const lines = Array.isArray(slide.lines)
        ? slide.lines.filter((line) => typeof line === "string" && line.trim())
        : [];
      if (!lines.length || isTopicOutline(lines)) continue;
      if (
        slide.isTitleSlide === undefined &&
        lines.length <= 2 &&
        lines.every(
          (line) =>
            line.length < 100 &&
            !/[:.!?]|\b(?:is|are|means|has|have|can|requires|converts|stores|measures|transmits|produces|controls)\b/i.test(
              line,
            ),
        )
      )
        continue;
      eligible.push({ deck, slide });
    }
  }
  return eligible;
}
function factFromLine(line) {
  const quote = line.replace(/\s+/g, " ").trim();
  if (quote.length < 14 || quote.length > 300) return null;
  const termPattern = "([\\p{L}\\p{N}][\\p{L}\\p{N} '’()/-]{0,69}?)";
  let match = quote.match(
    new RegExp("^" + termPattern + "\\s*:\\s+(.{8,})$", "u"),
  );
  if (match)
    return {
      term: match[1].trim(),
      predicate: match[2],
      connector: ":",
      group: "definition",
      quote,
    };
  match = quote.match(
    new RegExp(
      "^" +
        termPattern +
        "\\s+(is|are|means|has|have|can|requires|converts|stores|measures|transmits|produces|controls)\\s+(.{8,})$",
      "iu",
    ),
  );
  if (!match || match[1].trim().split(/\s+/).length > 7) return null;
  const connector = match[2].toLowerCase();
  return {
    term: match[1].trim(),
    predicate: match[3],
    connector,
    group: ["is", "means"].includes(connector)
      ? "singular-definition"
      : connector,
    quote,
  };
}
function generateOffline(decks, settings = {}) {
  const count = bounded(settings.levelCount, 1, 20, 3),
    per = bounded(settings.questionsPerLevel, 1, 20, 2),
    distractors = bounded(settings.distractors, 1, 7, 3);
  const pool = [];
  for (const { deck, slide } of getEligibleSlides(decks)) {
    for (const line of slide.lines || []) {
      const fact = factFromLine(line);
      if (
        !fact ||
        /^(?:this|that|it|these|those|we|you|they|he|she)$/i.test(fact.term) ||
        normalize(fact.predicate).includes(normalize(fact.term))
      )
        continue;
      if (!pool.some((p) => normalize(p.quote) === normalize(fact.quote)))
        pool.push({ ...fact, deck, slide });
    }
  }
  const questions = [];
  for (const item of pool) {
    // Explicitly shared predicates (including known synonyms) cannot yield a unique answer.
    if (
      pool.some(
        (p) =>
          normalize(p.term) !== normalize(item.term) &&
          normalize(p.predicate) === normalize(item.predicate),
      )
    )
      continue;
    const seen = new Set([normalize(item.term)]);
    const alternatives = pool
      .filter((p) => {
        const term = normalize(p.term);
        if (
          p.group !== item.group ||
          seen.has(term) ||
          normalize(item.quote).includes(term) ||
          term.includes(normalize(item.term)) ||
          normalize(item.term).includes(term)
        )
          return false;
        // A term with this same evidenced relation is not a defensible distractor.
        if (
          pool.some(
            (other) =>
              normalize(other.term) === term &&
              normalize(other.predicate) === normalize(item.predicate),
          )
        )
          return false;
        seen.add(term);
        return true;
      })
      .slice(0, distractors);
    if (alternatives.length < distractors) continue;
    const definition = [":", "is", "are", "means"].includes(item.connector);
    const prompt =
      item.connector === ":"
        ? `Which term matches this definition? “${item.predicate}”`
        : `Complete the statement: “_____ ${item.connector} ${item.predicate}”`;
    questions.push({
      id: `content-${questions.length + 1}`,
      type: definition ? "matching" : "concept",
      title: definition ? "Match the concept" : "Complete the fact",
      prompt,
      choices: [
        { id: "answer", text: item.term },
        ...alternatives.map((p, i) => ({ id: `option-${i}`, text: p.term })),
      ],
      correctIds: ["answer"],
      ordered: false,
      explanation: `${item.term} completes this statement. The presentation states: “${item.quote}”`,
      source: {
        deckId: item.deck.id,
        slideNumber: item.slide.number,
        quote: item.quote,
      },
    });
  }
  if (questions.length < count * per)
    throw Error(
      `Only ${questions.length} content questions can be grounded with ${distractors} compatible distractors after excluding title slides. Add explicit term definitions or factual sentences, reduce the requested count or distractors, or use local AI/manual authoring. No slide-location questions are substituted.`,
    );
  const levels = Array.from({ length: count }, (_, i) => ({
    id: `level-${i + 1}`,
    title: `Concept mission ${i + 1}`,
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
  getEligibleSlides,
};
