const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateOffline,
  validateLevels,
  getEligibleSlides,
} = require("../src/content");
const decks = [
  {
    id: "d",
    name: "Robotics",
    slides: [
      {
        number: 1,
        lines: ["Robot systems"],
        text: "Robot systems",
        isTitleSlide: true,
      },
      {
        number: 2,
        lines: [
          "Motor is a device that converts electrical energy into motion.",
        ],
        text: "Motor is a device that converts electrical energy into motion.",
      },
      {
        number: 3,
        lines: ["Battery is a source of stored electrical energy."],
        text: "Battery is a source of stored electrical energy.",
      },
      {
        number: 4,
        lines: ["Sensor is a component that detects environmental changes."],
        text: "Sensor is a component that detects environmental changes.",
      },
      {
        number: 5,
        lines: ["Gear is a toothed wheel that transmits rotation."],
        text: "Gear is a toothed wheel that transmits rotation.",
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
  assert.match(levels[0].questions[0].prompt, /Complete the statement/);
  assert.equal(levels[0].questions[0].choices[0].text, "Motor");
  for (const level of levels)
    for (const q of level.questions) {
      assert.doesNotMatch(q.prompt, /slide|appears|presentation order/i);
      assert.ok(q.source.slideNumber > 1);
      assert.ok(q.source.quote.includes(q.choices[0].text));
    }
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

test("exclude opening slides and subsequent title-only slides from all generation sources", () => {
  const extra = structuredClone(decks);
  extra[0].slides[0] = {
    number: 1,
    lines: ["Title is a heading that must never become a question."],
    text: "Title is a heading that must never become a question.",
  };
  extra[0].slides.push({
    number: 6,
    lines: ["Motion systems"],
    text: "Motion systems",
    isTitleSlide: true,
  });
  extra[0].slides.push({
    number: 7,
    lines: ["Electrical systems"],
    text: "Electrical systems",
  });
  assert.deepEqual(
    getEligibleSlides(extra).map((x) => x.slide.number),
    [2, 3, 4, 5],
  );
  const levels = generateOffline(extra, {
    levelCount: 1,
    questionsPerLevel: 4,
    distractors: 3,
  });
  assert.ok(
    levels[0].questions.every(
      (q) => q.source.slideNumber > 1 && q.source.slideNumber < 6,
    ),
  );
});
test("colon definitions generate content matching rather than slide recognition", () => {
  const deck = {
    id: "definitions",
    name: "Terms",
    slides: [
      { number: 1, lines: ["Terminology"], text: "Terminology" },
      ...[
        "Torque: A turning effect produced by an applied force.",
        "Voltage: An electrical potential difference between two points.",
        "Current: A flow of electric charge through a conductor.",
      ].map((text, i) => ({ number: i + 2, text, lines: [text] })),
    ],
  };
  const q = generateOffline([deck], {
    levelCount: 1,
    questionsPerLevel: 1,
    distractors: 2,
  })[0].questions[0];
  assert.equal(q.type, "matching");
  assert.equal(q.choices[0].text, "Torque");
  assert.match(q.prompt, /turning effect/);
  assert.doesNotMatch(q.prompt, /Torque/);
});
test("known shared definitions are rejected as ambiguous rather than mislabeled", () => {
  const deck = {
    id: "ambiguous",
    name: "Terms",
    slides: [
      { number: 1, lines: ["Title"], text: "Title" },
      ...[
        "Speed: Distance traveled per unit of time.",
        "Rate: Distance traveled per unit of time.",
      ].map((text, i) => ({ number: i + 2, text, lines: [text] })),
    ],
  };
  assert.throws(
    () =>
      generateOffline([deck], {
        levelCount: 1,
        questionsPerLevel: 1,
        distractors: 1,
      }),
    /Only 0 content questions/,
  );
});
test("unstructured bullet fragments fail explicitly without slide-location fallback", () => {
  const deck = {
    id: "bullets",
    name: "Bullets",
    slides: [
      { number: 1, lines: ["Title"], text: "Title" },
      {
        number: 2,
        lines: ["Energy storage", "Motion control", "Input processing"],
        text: "Energy storage Motion control Input processing",
      },
    ],
  };
  assert.throws(
    () =>
      generateOffline([deck], {
        levelCount: 1,
        questionsPerLevel: 1,
        distractors: 1,
      }),
    /No slide-location questions/,
  );
});
