"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
function createLocalAI(dataDirectory) {
  const base = path.join(dataDirectory, 'local-ai');
  const python = path.join(base, 'runtime', 'bin', 'python');
  const model = path.join(base, 'model-qwen35');
  const packaged = process.resourcesPath && path.join(process.resourcesPath, 'local-ai', 'local-model.py');
  const script = packaged && fs.existsSync(packaged) ? packaged : path.join(__dirname,'local-model.py');
  let worker, pending;
  function checkLocalAI() {
    const available = process.platform === 'darwin' && process.arch === 'arm64' &&
      fs.existsSync(python) && fs.existsSync(path.join(base,'qwen35-ready.json')) &&
      fs.existsSync(path.join(model,'config.json')) && ['model-00001-of-00002.safetensors','model-00002-of-00002.safetensors'].every(file => fs.existsSync(path.join(model,file)));
    return { available, message: available ? 'Local study AI · Qwen3.5 9B · Ready on this Mac.' : 'Local study AI is not installed on this Mac.' };
  }
  function generateAppleQuestion(request) {
    if (!checkLocalAI().available) return Promise.reject(Error('Local study AI is not installed.'));
    if (!request || typeof request.text !== 'string' || request.text.length > 8000)
      return Promise.reject(Error('Invalid source text.'));
    if (pending) return Promise.reject(Error('Generation is already in progress.'));
    if (!worker) {
      const child = spawn(python, ['-u',script,model], {stdio:['pipe','pipe','ignore'],
        env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}});
      worker = child;
      let buffer = '';
      const fail = () => { if (worker === child) dispose('Local study AI could not run.'); };
      child.on('error',fail); child.on('close',fail); child.stdin.on('error',fail);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data',chunk => {
        if (worker !== child) return;
        buffer += chunk;
        if (buffer.length > 256*1024) return fail();
        if (!buffer.includes('\n')) return;
        let result;
        try { result = JSON.parse(buffer); } catch { return fail(); }
        buffer = '';
        if (!pending) return fail();
        const job=pending; pending=null; clearTimeout(job.timer);
        if (result.error) job.reject(Error('Local study AI: '+result.error)); else job.resolve(result);
      });
    }
    return new Promise((resolve,reject) => {
      pending={resolve,reject,timer:setTimeout(()=>dispose('Local study AI timed out.'),300000)};
      worker.stdin.write(JSON.stringify(request)+'\n');
    });
  }
  function dispose(message='Local study AI stopped.') {
    const child=worker; worker=null;
    if (pending) { clearTimeout(pending.timer); pending.reject(Error(message)); pending=null; }
    if (child) child.kill();
  }
  return {directQuestions:true,checkLocalAI,checkAppleAI:checkLocalAI,generateAppleQuestion,dispose};
}
module.exports={createLocalAI};
