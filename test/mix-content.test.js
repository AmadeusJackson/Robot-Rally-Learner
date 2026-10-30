const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mixSources } = require('../src/mix-content');
const { generateOffline, validateLevels } = require('../src/content');
const { generateAppleLevels } = require('../src/apple-generation');
const deck = (id, lines) => ({id, name:id, slides:['Lesson title',...lines].map((text,i)=>({number:i+1,text,lines:[text]}))});
const decks = [
 deck('physics',['Energy is the capacity to do work.','Velocity is the rate of change of position.','Force is a push or pull on an object.','Mass is the amount of matter in an object.']),
 deck('biology',['Mitochondria are the organelles that release energy from food.','Chloroplasts are the organelles that absorb light for photosynthesis.']),
];
test('mixing shares short runs across unequal sources, preserves items, and varies ordering',()=>{
 const items = [{id:'a',n:1},{id:'a',n:2},{id:'a',n:3},{id:'b',n:4},{id:'c',n:5}];
 const a = mixSources(items, x=>x.id,()=>0);
 const b = mixSources(items, x=>x.id,()=>.999);
 assert.equal(new Set(a.slice(0,3).map(x=>x.id)).size,3);
 assert.equal(new Set(a).size,items.length);
 assert.notDeepEqual(a,b);
 assert.deepEqual(mixSources([],x=>x.id),[]);
});
test('offline mixes decks within levels and covers each usable deck in short runs',()=>{
 for(let i=0;i<12;i++) {
  const levels=generateOffline(decks,{levelCount:2,questionsPerLevel:2,distractors:1});
  for(const level of levels) assert.equal(new Set(level.questions.map(q=>q.source.deckId)).size,2);
  assert.equal(validateLevels(levels,decks).valid,true);
 }
});
test('Apple samples both decks before exhausting the first and retains source evidence',async()=>{
 const levels=await generateAppleLevels(decks,{levelCount:1,questionsPerLevel:2,distractors:1},{
  checkAppleAI:async()=>({available:true}),
  generateAppleQuestion:async ({text})=>({prompt:'What is '+text.split(' ')[0]+'?',answer:text.split(' ')[0],quote:text,explanation:text,distractors:['Temperature']})
 });
 assert.equal(new Set(levels[0].questions.map(q=>q.source.deckId)).size,2);
 assert.equal(validateLevels(levels,decks).valid,true);
});
