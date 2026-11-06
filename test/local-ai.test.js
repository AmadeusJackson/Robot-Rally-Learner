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
    fs.writeFileSync(path.join(base,'qwen35-ready.json'),'{}');
    assert.equal(provider.checkLocalAI().available,false);
    await assert.rejects(provider.generateAppleQuestion({text:'Example teaching content'}),/not installed/);
  } finally {provider.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('one worker survives a rejected candidate and releases on disposal', {skip:process.platform!=='darwin'||process.arch!=='arm64'}, async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rally-worker-'));
  const base=path.join(dir,'local-ai'), provider=createLocalAI(dir);
  try {
    for(const sub of ['runtime/bin','model-qwen35']) fs.mkdirSync(path.join(base,sub),{recursive:true});
    for(const file of ['qwen35-ready.json','model-qwen35/config.json',...['00001','00002'].map(n=>'model-qwen35/model-'+n+'-of-00002.safetensors')]) fs.writeFileSync(path.join(base,file),'');
    fs.writeFileSync(path.join(base,'runtime/bin/python'),'#!'+process.execPath+'\n'+
      "require('node:readline').createInterface({input:process.stdin}).on('line',line=>{let s=JSON.parse(line).text;if(s!=='wait') console.log(JSON.stringify(s==='reject'?{error:'ambiguous'}:{pid:process.pid}));});",{mode:0o755});
    const run=text=>provider.generateAppleQuestion({text});
    const first=await run('first');
    await assert.rejects(run('reject'),/ambiguous/);
    assert.equal((await run('next')).pid,first.pid);
    const interrupted=run('wait');provider.dispose();
    await assert.rejects(interrupted,/stopped/);
    assert.notEqual((await run('new run')).pid,first.pid);
  } finally {provider.dispose();fs.rmSync(dir,{recursive:true,force:true});}
});
