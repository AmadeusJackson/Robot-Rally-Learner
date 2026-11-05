"use strict";
const { getEligibleSlides, validateLevels } = require("./content");
const { mixSources } = require("./mix-content");
const { settingsCheck, decksCheck } = require("./state-validation");

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

async function generateAppleLevels(decks, settings, provider, onProgress = () => {}) {
  decksCheck(decks);
  settings = settingsCheck(settings);
  const status = await provider.checkAppleAI();
  if (!status.available)
    throw Error(
      status.message ||
        "AI is unavailable on this Mac. Choose offline content practice.",
    );
  const allEligible = getEligibleSlides(decks);
  // Reasoning needs relationships and context; prefer substantive teaching
  // slides over isolated labels and diagram fragments within each deck.
  const candidates = decks.flatMap(deck => {
    const slides = allEligible.filter(item => item.deck.id === deck.id);
    const substantive = slides.filter(({slide}) => {
      const lines = (slide.lines || []).filter(line => !/copyright|permission|reserved|access the text/i.test(line));
      return lines.filter(line => line.length >= 55).length >= 2 &&
        (lines.join(" ").match(/\p{L}{3,}/gu) || []).length >= 40;
    });
    return settings.difficulty !== "easy" && substantive.length ? substantive : slides;
  });
  const eligible = mixSources(candidates, item => item.deck.id);
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
    onProgress({accepted: questions.length, total, attempt: i + 1});
    try {
      const { deck, slide } = eligible[i % eligible.length];
      const text = [
        provider.directQuestions ? slide.text : slide.text.replace(/<number>/gi, ""),
        slide.notes || "",
        ...(slide.tables || []).map((t) =>
          t.map((row) => row.join(" | ")).join("\n"),
        ),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 6500);
      const vocabulary = [...new Set((slide.lines || [])
        .map(line => line.replace(/<number>/gi, "").split(/[:–—]|\s+(?:is|are|means)\s+/i)[0].trim())
        .filter(term => term.length >= 3 && term.length <= 70 && term.split(/\s+/).length <= 6 &&
          !/copyright|reserved|figure|http|access the/i.test(term)))].slice(0, 40);
      const contextSlides = provider.directQuestions ? candidates.filter(item => item.deck.id === deck.id && item.slide.number !== slide.number)
        .sort((a,b) => Math.abs(a.slide.number-slide.number)-Math.abs(b.slide.number-slide.number)).slice(0,4) : [];
      const draft = await provider.generateAppleQuestion({
        text,
        context: contextSlides.map(item => item.slide.text.slice(0,1500)),
        vocabulary,
        difficulty: settings.difficulty,
        distractors: settings.distractors,
        previousPrompts: questions
          .filter(
            (q) =>
              q.source.deckId === deck.id,
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
          "AI did not produce the requested answer options. Try fewer distractors or another content slide.",
        );
      if (
        typeof draft.prompt !== "string" ||
        /\b(slide|presentation|deck)\b/i.test(draft.prompt)
      )
        throw Error(
          "AI returned a question about the presentation instead of its subject matter. Regenerate the questions.",
        );
      const review = draft.review;
      if (provider.directQuestions && (!review || typeof review.selectedAnswer !== "string" ||
          review.selectedAnswer.trim().toLowerCase() !== String(draft.answer).trim().toLowerCase() || review.hasExactlyOneCorrectAnswer !== true || review.isGrounded !== true ||
          (settings.difficulty !== "easy" && review.requiresReasoning !== true)))
        throw Error("Question failed grounding, answer, or difficulty review.");
      if (provider.directQuestions && /_{3,}|fill.in.the.blank|complete (?:this|the) (?:statement|explanation)/i.test(draft.prompt))
        throw Error("AI returned a recall template instead of a conceptual question.");
      const key = draft.prompt.toLowerCase().replace(/\W+/g, " ").trim();
      if (seen.has(key))
        throw Error(
          "AI repeated a question. Reduce the question count or add more teaching content.",
        );
      const question = {
        id: `apple-q-${questions.length + 1}`,
        type: provider.directQuestions ? "application" : "concept",
        title: "Content challenge",
        prompt: provider.directQuestions ? draft.prompt.trim() : contentPrompt(draft.quote, draft.answer),
        choices: [
          { id: "answer", text: draft.answer },
          ...draft.distractors.map((text, n) => ({ id: `option-${n}`, text })),
        ],
        correctIds: ["answer"],
        ordered: false,
        explanation: draft.explanation,
        source: {
          deckId: deck.id,
          slideNumber: draft.sourceIndex > 0 ? contextSlides[draft.sourceIndex - 1]?.slide.number : slide.number,
          quote: draft.quote,
        },
      };
      const result = validateLevels(
        [{ id: "validation", title: "Validation", questions: [question] }],
        decks,
      );
      if (!result.valid)
        throw Error(
          "AI produced a question that could not be grounded in the source: " +
            result.errors.join("; "),
        );
      seen.add(key);
      questions.push(question);
    } catch (error) {
      lastFailure = error.message;
      if (/timed out|could not run|not installed|unavailable/i.test(lastFailure))
        throw error;
    }
  }
  if (!questions.length)
    throw Error(
      `Only ${questions.length} of ${total} questions passed content and answer checks. Try fewer questions or more teaching material. Last check: ${lastFailure}`,
    );
  const mixed = mixSources(questions, q => q.source.deckId);
  return Array.from({ length: Math.ceil(mixed.length / per) }, (_, i) => ({
    id: `apple-level-${i + 1}`,
    title: `Learning mission ${i + 1}`,
    questions: mixed.slice(i * per, (i + 1) * per),
  }));
}
module.exports = { generateAppleLevels };
