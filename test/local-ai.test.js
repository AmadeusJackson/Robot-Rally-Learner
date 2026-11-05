'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createLocalAI}=require('../src/local-ai');
test('incomplete local model installation stays unavailable and cannot launch',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rally-local-ai-'));
  const provider=createLocalAI(directory);
  try {
    assert.equal(provider.checkLocalAI().available,false);
    const base=path.join(directory,'local-ai');
    fs.mkdirSync(path.join(base,'runtime/bin'),{recursive:true});
    fs.writeFileSync(path.join(base,'runtime/bin/python'),'');
    fs.writeFileSync(path.join(base,'ready.json'),'{}');
    assert.equal(provider.checkLocalAI().available,false);
    await assert.rejects(provider.generateAppleQuestion({text:'Example teaching content'}),/not installed/);
  } finally {provider.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
