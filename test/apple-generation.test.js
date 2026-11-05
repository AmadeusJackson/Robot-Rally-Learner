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
const review = { selectedAnswer: "Acceleration", hasExactlyOneCorrectAnswer: true, isGrounded: true, plausibleDistractors: true, requiresReasoning: true };
const draft = {
  review,
  prompt: "Which quantity is the rate of change of velocity?",
  answer: "Acceleration",
  distractors: ["Mass"],
  explanation: "Acceleration measures change in velocity.",
  quote: decks[0].slides[1].text,
};
function provider(change = {}) {
  return {
    directQuestions: true,
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
test("approved application prompt survives unchanged instead of becoming a cloze", async () => {
  const prompt = "A cart changes velocity each second. Which quantity describes that change?";
  const levels = await generateAppleLevels(decks, {...settings, difficulty: "medium"}, provider({prompt}));
  assert.equal(levels[0].questions[0].prompt, prompt);
});
test("reject unsupported relations, ambiguous answers and recall at medium difficulty", async () => {
  for (const flag of ["isGrounded", "hasExactlyOneCorrectAnswer", "requiresReasoning"]) {
    await assert.rejects(() => generateAppleLevels(decks, {...settings, difficulty:"medium"},
      provider({review:{...review,[flag]:false}})), /review/);
  }
  await assert.rejects(() => generateAppleLevels(decks, settings, provider({review:undefined})), /review/);
  await assert.rejects(() => generateAppleLevels(decks, settings, provider({review:{...review,selectedAnswer:"Mass"}})), /review/);
  await assert.rejects(() => generateAppleLevels(decks, settings, provider({prompt:"Complete the statement: _____ changes velocity."})), /recall template/);
});
test("easy allows conceptual recall while hard requires reasoning", async () => {
  const p = provider({review:{...review,requiresReasoning:false}});
  assert.equal((await generateAppleLevels(decks, {...settings,difficulty:"easy"},p)).length,1);
  await assert.rejects(() => generateAppleLevels(decks, {...settings,difficulty:"hard"},p), /review/);
});

test("keep accepted questions in a shorter draft when later candidates fail", async () => {
  let calls = 0;
  const p = provider();
  p.generateAppleQuestion = async () => { if(calls++ === 0) return draft; throw Error("weak question"); };
  const levels = await generateAppleLevels(decks, {...settings,questionsPerLevel:2}, p);
  assert.equal(levels.length,1);
  assert.equal(levels[0].questions.length,1);
  assert.equal(levels[0].questions[0].prompt,draft.prompt);
});

test("Apple fallback retains source sentence practice", async () => {
 const p=provider();p.directQuestions=false;
 const levels=await generateAppleLevels(decks,settings,p);
 assert.match(levels[0].questions[0].prompt,/Complete this explanation/);
});

test("local evidence preserves embedded slide-number markers for exact citation validation", async () => {
 const ds=structuredClone(decks);
 ds[0].slides[1].text="Acceleration changes velocity. <number> Force produces acceleration.";
 ds[0].slides[1].lines=[ds[0].slides[1].text];
 const p=provider();
 p.generateAppleQuestion=async input=>({...draft,quote:input.text});
 const levels=await generateAppleLevels(ds,settings,p);
 assert.match(levels[0].questions[0].source.quote,/<number>/);
});

test("local questions receive nearby teaching context from their own presentation only", async () => {
 const ds=structuredClone(decks);
 ds[0].slides.push({number:3,text:"Force can produce acceleration.",lines:["Force can produce acceleration."]});
 ds.push({id:"other",name:"Biology",slides:[{number:1,text:"Other title",lines:["Other title"]}]});
 const p=provider();
 p.generateAppleQuestion=async input=>{
   assert.ok(input.context.join(" ").includes("Acceleration") || input.context.join(" ").includes("Force"));
   assert.doesNotMatch(input.context.join(" "),/Other title|Physics title/);
   return {...draft,quote:input.text};
 };
 await generateAppleLevels(ds,settings,p);
});

test("a local answer cites the actual supporting neighboring slide", async () => {
 const ds=structuredClone(decks);
 ds[0].slides.push({number:3,text:"Force can produce acceleration.",lines:["Force can produce acceleration."]});
 const p=provider();p.generateAppleQuestion=async input=>({...draft,quote:input.context[0],sourceIndex:1});
 const levels=await generateAppleLevels(ds,settings,p);
 const q=levels[0].questions[0];
 assert.equal(q.source.quote,ds[0].slides.find(s=>s.number===q.source.slideNumber).text);
});
