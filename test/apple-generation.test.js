const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateAppleLevels } = require("../src/apple-generation");
const decks = [
  {
    id: "d",
    name: "Physics",
    slides: [
      { number: 1, text: "Physics title", lines: ["Physics title"] },
      {
        number: 2,
        text: "Acceleration is the rate of change of velocity.",
        lines: ["Acceleration is the rate of change of velocity."],
      },
    ],
  },
];
const settings = { levelCount: 1, questionsPerLevel: 1, distractors: 1 };
const draft = {
  prompt: "Which quantity is the rate of change of velocity?",
  answer: "Acceleration",
  distractors: ["Mass"],
  explanation: "Acceleration measures change in velocity.",
  quote: decks[0].slides[1].text,
};
function provider(change = {}) {
  return {
    checkAppleAI: async () => ({ available: true }),
    generateAppleQuestion: async () => ({ ...draft, ...change }),
  };
}
test("Apple generation uses teaching content and excludes title slide", async () => {
  const p = provider();
  p.generateAppleQuestion = async (input) => {
    assert.doesNotMatch(input.text, /Physics title/);
    return draft;
  };
  const l = await generateAppleLevels(decks, settings, p);
  assert.equal(l[0].questions[0].source.slideNumber, 2);
  assert.equal(l[0].questions[0].choices[0].text, "Acceleration");
});
test("unavailable Apple model fails explicitly without calling generation", async () => {
  await assert.rejects(
    () =>
      generateAppleLevels(decks, settings, {
        checkAppleAI: async () => ({
          available: false,
          message: "Model downloading",
        }),
        generateAppleQuestion: () => assert.fail(),
      }),
    /Model downloading/,
  );
});
test("Apple response cannot revert to slide-location questions or invent evidence", async () => {
  await assert.rejects(
    () =>
      generateAppleLevels(
        decks,
        settings,
        provider({ prompt: "What appears on this slide?" }),
      ),
    /presentation instead/,
  );
  await assert.rejects(
    () =>
      generateAppleLevels(
        decks,
        settings,
        provider({ quote: "Made up quote" }),
      ),
    /grounded/,
  );
});
test("Apple response rejects duplicate or missing choices", async () => {
  await assert.rejects(
    () =>
      generateAppleLevels(
        decks,
        settings,
        provider({ distractors: ["Acceleration"] }),
      ),
    /Duplicate/,
  );
  await assert.rejects(
    () => generateAppleLevels(decks, settings, provider({ distractors: [] })),
    /requested answer options/,
  );
});
