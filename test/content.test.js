const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateOffline, validateLevels } = require("../src/content");
const decks = [
  {
    id: "d",
    name: "Physics",
    slides: [
      {
        number: 1,
        lines: ["Energy is conserved in an isolated system."],
        text: "Energy is conserved in an isolated system.",
      },
      {
        number: 2,
        lines: ["Velocity has both magnitude and direction."],
        text: "Velocity has both magnitude and direction.",
      },
      {
        number: 3,
        lines: ["A force can change the motion of an object."],
        text: "A force can change the motion of an object.",
      },
    ],
  },
];
const make = () =>
  generateOffline(decks, {
    levelCount: 1,
    questionsPerLevel: 2,
    distractors: 1,
  });
test("offline produces distinct grounded questions and real source references", () => {
  const levels = make();
  assert.equal(levels[0].questions.length, 2);
  assert.equal(validateLevels(levels, decks).valid, true);
  assert.match(levels[0].questions[0].explanation, /not being labeled false/);
});
test("reject duplicate choices even with different casing", () => {
  const l = make();
  l[0].questions[0].choices[1].text =
    l[0].questions[0].choices[0].text.toUpperCase();
  assert.equal(validateLevels(l, decks).valid, false);
});
test("reject unsupported quote or correct answer", () => {
  const l = make();
  l[0].questions[0].source.quote = "Fabricated information";
  assert.equal(validateLevels(l, decks).valid, false);
  const other = make();
  other[0].questions[0].choices[0].text = "Unsupported answer";
  assert.equal(validateLevels(other, decks).valid, false);
});
test("reject duplicate IDs and missing answer", () => {
  const l = make();
  l[0].questions[1].id = l[0].questions[0].id;
  l[0].questions[0].correctIds = ["missing"];
  assert.equal(validateLevels(l, decks).valid, false);
});
test("do not fabricate content to fill requested count", () =>
  assert.throws(
    () => generateOffline(decks, { levelCount: 20, questionsPerLevel: 2 }),
    /Only/,
  ));
test("reject malformed structures", () => {
  for (const x of [
    null,
    {},
    [],
    [null],
    [{ id: "l", title: "x", questions: [null] }],
  ])
    assert.equal(validateLevels(x, decks).valid, false);
});
test("runtime schema rejects unexpected fields and malformed sources without crashing", () => {
  const extra = make();
  extra[0].questions[0].unsupported = "value";
  assert.equal(validateLevels(extra, decks).valid, false);
  for (const source of [
    null,
    [],
    { deckId: "d", slideNumber: 1.5, quote: "Energy" },
  ]) {
    const levels = make();
    levels[0].questions[0].source = source;
    assert.equal(validateLevels(levels, decks).valid, false);
  }
  assert.equal(
    validateLevels(make(), [null, { id: "d", slides: {} }]).valid,
    false,
  );
});
