"use strict";
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs/promises'), os=require('node:os'), path=require('node:path');
const {createHash}=require('node:crypto');
const {createUpdater,selectInstaller}=require('../src/updates');
const bytes=Buffer.from('installer fixture');
const name='Robot-Rally-Learning-1.10.0-arm64.dmg';
const asset={name, size:bytes.length,digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),
  browser_download_url:'https://github.com/AmadeusJackson/Robot-Rally-Learner/releases/download/v1.10.0/'+name};
const release={tag_name:'v1.10.0',assets:[asset]};
test('selects a newer stable installer for this architecture',()=>{
 assert.equal(selectInstaller(release,'1.9.9','arm64').version,'1.10.0');
 assert.equal(selectInstaller(release,'1.10.1','arm64'),null);
 assert.throws(()=>selectInstaller(release,'1.0.0','x64'));
 assert.throws(()=>selectInstaller({...release,prerelease:true},'1.0.0','arm64'));
 assert.throws(()=>selectInstaller({...release,assets:[{...asset,browser_download_url:'https://example.org/file'}]},'1.0.0','arm64'));
});
test('opens only verified downloads and cleans up damaged ones',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'rally-update-test-'));
 let body=Buffer.alloc(bytes.length), opened;
 const updater=createUpdater({directory,version:'1.9.9',arch:'arm64',
   request:async url=>url===asset.browser_download_url?new Response(body):Response.json(release),
   openPath:async file=>{opened=await fs.readFile(file);return '';}});
 try {
   await assert.rejects(updater.download(),/Check for an update/);
   assert.ok((await updater.check()).available);
   await assert.rejects(updater.download(),/verification failed/);
   assert.equal(opened,undefined);assert.deepEqual(await fs.readdir(directory),[]);
   body=bytes;await updater.download();assert.deepEqual(opened,bytes);
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});
