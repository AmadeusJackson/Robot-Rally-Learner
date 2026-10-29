const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const AdmZip = require('adm-zip');
let win;
const allowed = new Set(['.pptx','.ppt']);
function decodeXml(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));}
function pptxText(file){
  const zip = new AdmZip(file);
  const slides = zip.getEntries().filter(e=>/^ppt\/slides\/slide\d+\.xml$/.test(e.entryName)).sort((a,b)=>Number(a.entryName.match(/slide(\d+)/)[1])-Number(b.entryName.match(/slide(\d+)/)[1]));
  return slides.map((entry,i)=>{
    const xml=entry.getData().toString('utf8');
    const blocks=[...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)].map(m=>[...m[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(t=>decodeXml(t[1])).join('').trim()).filter(Boolean);
    return {number:i+1,lines:blocks, text:blocks.join(' ')};
  }).filter(x=>x.lines.length);
}
function readPresentation(file){
  if(path.extname(file).toLowerCase()==='.pptx')return pptxText(file);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'robot-rally-'));
  try{
    const cmd=process.platform==='win32'?'soffice':'libreoffice';
    cp.execFileSync(cmd,['-env:UserInstallation=file://'+path.join(temp,'lo-profile'),'--headless','--convert-to','pptx','--outdir',temp,file],{timeout:60000,stdio:'pipe'});
    const output=path.join(temp,path.basename(file,'.ppt')+'.pptx');
    if(!fs.existsSync(output))throw Error('Conversion produced no PPTX file.');
    return pptxText(output);
  }catch(e){throw Error('Legacy .ppt files require LibreOffice installed on your computer. Alternatively, save as .pptx. '+e.message)}
  finally{fs.rmSync(temp,{recursive:true,force:true});}
}
function createWindow(){win=new BrowserWindow({width:1200,height:850,minWidth:880,minHeight:620,backgroundColor:'#0b1322',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});win.loadFile(path.join(__dirname,'index.html'));win.webContents.setWindowOpenHandler(()=>({action:'deny'}));}
app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
ipcMain.handle('select-presentations',async()=>{
 const r=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'PowerPoint',extensions:['pptx','ppt']}]});
 if(r.canceled)return [];
 return r.filePaths.map(f=>{try{if(!allowed.has(path.extname(f).toLowerCase()))throw Error('Unsupported format');let slides=readPresentation(f);return {name:path.basename(f),slides,slideCount:slides.length}}catch(e){return {name:path.basename(f),error:e.message}}});
});
ipcMain.handle('check-ollama',async()=>{try{let r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(1800)});if(!r.ok)throw Error('Unavailable');let v=await r.json();return {available:true,models:(v.models||[]).map(m=>m.name)}}catch{return {available:false,models:[]}}});
ipcMain.handle('generate-ollama',async(_,payload)=>{
 const model=String(payload.model||'').slice(0,100);if(!/^[\w.:-]+$/.test(model))throw Error('Invalid model');
 const slides=(payload.slides||[]).slice(0,100).map(s=>`Slide ${s.number}: ${String(s.text||'').slice(0,1600)}`).join('\n').slice(0,22000);
 const count=Math.max(1,Math.min(20,Number(payload.count)||3));const difficulty=['easy','medium','hard'].includes(payload.difficulty)?payload.difficulty:'medium';
 const prompt=`You are making a scientifically accurate educational robot-driving game from slides. Return ONLY a JSON object {"levels":[{"title":"...","description":"...","steps":["..."],"decoys":["..."],"explanations":["..."]}]}. Exactly ${count} levels. Each level has ${difficulty==='easy'?3:difficulty==='medium'?4:5} short ordered steps (max 55 characters per step), 3 plausible but incorrect decoys, and one precise explanatory sentence per step. The order must be scientifically meaningful (cause/effect, process sequence), not simply slide order. Do not make up scientific facts not supported by the slides. Difficulty: ${difficulty}. Use diverse topics from the supplied content. Return JSON only.\nSLIDES:\n${slides}`;
 const response=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,prompt,stream:false,format:'json',options:{temperature:0.2,num_predict:6500}}),signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error('Local model returned '+response.status);
 const data=await response.json();let obj=JSON.parse(data.response);if(!Array.isArray(obj.levels))throw Error('Model returned invalid level format');
 return obj.levels.slice(0,count).map((l,i)=>({title:String(l.title||`Level ${i+1}`).slice(0,90),description:String(l.description||'Collect the steps in order').slice(0,400),steps:(l.steps||[]).map(String).slice(0,6),decoys:(l.decoys||[]).map(String).slice(0,5),explanations:(l.explanations||[]).map(String).slice(0,6)})).filter(l=>l.steps.length>=2&&l.decoys.length>=2);
});
