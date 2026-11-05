"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
function createLocalAI(dataDirectory) {
  const base = path.join(dataDirectory, 'local-ai');
  const python = path.join(base, 'runtime', 'bin', 'python');
  const model = path.join(base, 'model');
  const packaged = process.resourcesPath && path.join(process.resourcesPath, 'local-ai', 'local-model.py');
  const script = packaged && fs.existsSync(packaged) ? packaged : path.join(__dirname,'local-model.py');
  const children = new Set();
  function checkLocalAI() {
    const available = process.platform === 'darwin' && process.arch === 'arm64' &&
      fs.existsSync(python) && fs.existsSync(path.join(base,'ready.json')) &&
      fs.existsSync(path.join(model,'config.json')) && fs.existsSync(path.join(model,'model.safetensors'));
    return { available, message: available ? 'Local study AI · Qwen3 8B · Ready on this Mac.' : 'Local study AI is not installed on this Mac.' };
  }
  function generateAppleQuestion(request) {
    if (!checkLocalAI().available) return Promise.reject(Error('Local study AI is not installed.'));
    if (!request || typeof request.text !== 'string' || request.text.length > 8000)
      return Promise.reject(Error('Invalid source text.'));
    return new Promise((resolve,reject) => {
      const child = execFile(python,[script,model],{
        timeout:300000,maxBuffer:256*1024,encoding:'utf8',
        env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}
      },(error,stdout) => {
        children.delete(child);
        if(error) return reject(Error(error.killed ? 'Local study AI timed out. Try fewer questions.' : 'Local study AI could not run: '+error.message.slice(0,250)));
        try { const result=JSON.parse(stdout); if(result.error) throw Error(result.error); resolve(result); }
        catch(e){ reject(Error('Local study AI: '+e.message)); }
      });
      children.add(child);
      child.stdin.on('error',()=>{});
      child.stdin.end(JSON.stringify(request));
    });
  }
  return { directQuestions:true, checkLocalAI, checkAppleAI:checkLocalAI, generateAppleQuestion, dispose(){ for(const child of children) child.kill(); children.clear(); } };
}
module.exports={createLocalAI};
