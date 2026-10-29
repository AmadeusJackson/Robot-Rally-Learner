const {test}=require('node:test');
const assert=require('node:assert/strict');
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const fixture=require('./fixtures/deck.cjs');
const root=path.resolve(__dirname,'..');
test('select multiple files, cancel safely, append later, mix and persist decks', {timeout:120000}, async()=>{
 // Files live under Documents so actual controller import path validation runs.
 const temp=await fs.mkdtemp(path.join(root,'multi-deck-test-'));
 let app;
 try {
  const a=fixture(path.join(temp,'Physics.pptx'));
  const b=fixture(path.join(temp,'Biology.pptx'),['Biology','Mitochondria are the organelles that release energy from food.','Chloroplasts are the organelles that absorb light for photosynthesis.']);
  const c=fixture(path.join(temp,'Chemistry.pptx'),['Chemistry','Proton is a positively charged particle in an atomic nucleus.','Electron is a negatively charged particle surrounding an atomic nucleus.']);
  app=await electron.launch({args:[root],env:{...process.env,ROBOT_RALLY_USER_DATA:path.join(temp,'profile')}});
  const p=await app.firstWindow();
  await p.waitForFunction(()=>typeof state!=='undefined');
  await app.evaluate(({ipcMain}, files)=>{
   ipcMain.removeHandler('list-presentation-files');
   ipcMain.handle('list-presentation-files',()=>({path:'/lessons',parent:null,roots:[],entries:files.map(file=>({name:file.split('/').pop(),path:file,isDirectory:false}))}));
  },[a,b,c]);
  await p.locator('#home-import').click();
  await p.getByRole('button',{name:'▤ Physics.pptx',exact:true}).click();
  await p.getByRole('button',{name:'Cancel · B'}).click();
  assert.equal(await p.evaluate(()=>state.decks.length),0);
  await p.locator('#import').click();
  await p.getByRole('button',{name:'▤ Physics.pptx',exact:true}).click();
  await p.getByRole('button',{name:'▤ Biology.pptx',exact:true}).click();
  assert.equal(await p.locator('#import-selected').textContent(),'Import selected (2)');
  await p.locator('#import-selected').click();
  await p.waitForFunction(()=>state.decks.length===2);
  await p.locator('#import').click();
  await p.getByRole('button',{name:'▤ Chemistry.pptx',exact:true}).click();
  await p.locator('#import-selected').click();
  await p.waitForFunction(()=>state.decks.length===3);
  await p.locator('[data-page="configure"]').click();
  await p.locator('#mode').selectOption('offline');
  await p.locator('[data-setting="levelCount"]').fill('2');
  await p.locator('[data-setting="questionsPerLevel"]').fill('3');
  await p.locator('[data-setting="distractors"]').fill('1');
  await p.locator('#generate').click();
  await p.locator('#review').waitFor({state:'visible'});
  const levels=await p.evaluate(()=>state.levels);
  for(const l of levels) assert.equal(new Set(l.questions.map(q=>q.source.deckId)).size,3);
  assert.match(await p.locator('#generation-status').textContent(),/3 of 3 presentations/);
  await p.reload();
  await p.waitForFunction(()=>typeof state!=='undefined' && state.decks.length===3);
  assert.deepEqual(await p.evaluate(()=>state.levels),levels);
 } finally {if(app) await app.close(); await fs.rm(temp,{recursive:true,force:true});}
});
