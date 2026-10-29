"use strict";
const { getEligibleSlides, validateLevels } = require("./content");
const { settingsCheck, decksCheck } = require("./state-validation");

// Build the task from the verified quotation so the model cannot invent a causal
// relation in the question itself. This tests the taught content, never its location.
function contentPrompt(quote, answer) {
  if (typeof quote !== "string" || typeof answer !== "string") return "";
  const index = quote.toLowerCase().indexOf(answer.toLowerCase());
  if (index < 0) return "";
  const remaining = (
    quote.slice(0, index) + quote.slice(index + answer.length)
  ).trim();
  if (remaining.replace(/[^\p{L}\p{N}]/gu, "").length < 12)
    throw Error(
      "The source quotation does not provide enough context for a content question.",
    );
  const blank =
    quote.slice(0, index) + "_____" + quote.slice(index + answer.length);
  return `Complete this explanation with the term taught in the lesson: “${blank}”`;
}

async function generateAppleLevels(decks, settings, provider) {
  decksCheck(decks);
  settings = settingsCheck(settings);
  const status = await provider.checkAppleAI();
  if (!status.available)
    throw Error(
      status.message ||
        "Apple Intelligence is unavailable on this Mac. Choose offline content practice.",
    );
  const eligible = getEligibleSlides(decks);
  if (!eligible.length)
    throw Error(
      "No teaching content remains after skipping title slides. Import a presentation with content slides.",
    );
  const count = settings.levelCount,
    per = settings.questionsPerLevel,
    total = count * per;
  const questions = [],
    seen = new Set();
  let lastFailure = "";
  const maxAttempts = Math.min(total * 3, total + eligible.length);
  for (let i = 0; i < maxAttempts && questions.length < total; i++) {
    try {
      const { deck, slide } = eligible[i % eligible.length];
      const text = [
        slide.text.replace(/<number>/gi, ""),
        slide.notes || "",
        ...(slide.tables || []).map((t) =>
          t.map((row) => row.join(" | ")).join("\n"),
        ),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 6500);
      const draft = await provider.generateAppleQuestion({
        text,
        difficulty: settings.difficulty,
        distractors: settings.distractors,
        previousPrompts: questions
          .filter(
            (q) =>
              q.source.deckId === deck.id &&
              q.source.slideNumber === slide.number,
          )
          .map((q) => q.prompt)
          .slice(-6),
      });
      if (
        !draft ||
        !Array.isArray(draft.distractors) ||
        draft.distractors.length !== settings.distractors
      )
        throw Error(
          "Apple Intelligence did not produce the requested answer options. Try fewer distractors or another content slide.",
        );
      if (
        typeof draft.prompt !== "string" ||
        /\b(slide|presentation|deck)\b/i.test(draft.prompt)
      )
        throw Error(
          "Apple Intelligence returned a question about the presentation instead of its subject matter. Regenerate the questions.",
        );
      const key = draft.prompt.toLowerCase().replace(/\W+/g, " ").trim();
      if (seen.has(key))
        throw Error(
          "Apple Intelligence repeated a question. Reduce the question count or add more teaching content.",
        );
      const question = {
        id: `apple-q-${questions.length + 1}`,
        type: "concept",
        title: "Content challenge",
        prompt: contentPrompt(draft.quote, draft.answer),
        choices: [
          { id: "answer", text: draft.answer },
          ...draft.distractors.map((text, n) => ({ id: `option-${n}`, text })),
        ],
        correctIds: ["answer"],
        ordered: false,
        explanation: draft.explanation,
        source: {
          deckId: deck.id,
          slideNumber: slide.number,
          quote: draft.quote,
        },
      };
      const result = validateLevels(
        [{ id: "validation", title: "Validation", questions: [question] }],
        decks,
      );
      if (!result.valid)
        throw Error(
          "Apple Intelligence produced a question that could not be grounded in the source: " +
            result.errors.join("; "),
        );
      seen.add(key);
      questions.push(question);
    } catch (error) {
      lastFailure = error.message;
      if (/timed out|helper could not run|unavailable/i.test(lastFailure))
        throw error;
    }
  }
  if (questions.length !== total)
    throw Error(
      `Only ${questions.length} of ${total} questions passed content and answer checks. Try fewer questions or more teaching material. Last check: ${lastFailure}`,
    );
  return Array.from({ length: count }, (_, i) => ({
    id: `apple-level-${i + 1}`,
    title: `Learning mission ${i + 1}`,
    questions: questions.slice(i * per, (i + 1) * per),
  }));
}
module.exports = { generateAppleLevels, contentPrompt };
