"use strict";
// Optional one-time local model setup. No presentation content is sent anywhere.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
if(process.platform!=='darwin'||process.arch!=='arm64') throw Error('Local study AI requires an Apple Silicon Mac.');
const base=path.join(os.homedir(),'Library/Application Support/robot-rally-desktop/local-ai');
const python=path.join(base,'runtime/bin/python');
fs.mkdirSync(base,{recursive:true});
if (!fs.existsSync(python)) execFileSync('uv',['venv','--python','3.12',path.join(base,'runtime')],{stdio:'inherit'});
execFileSync('uv',['pip','install','--python',python,'mlx-lm==0.32.2','mlx==0.32.4','transformers==5.22.1','huggingface-hub==2.4.0'],{stdio:'inherit'});
execFileSync(python,['-c',`
from huggingface_hub import snapshot_download
import json, pathlib, sys
base=pathlib.Path(sys.argv[1])
revision='545dc4251c05440727734bcd94334791f6ab0192'
snapshot_download('mlx-community/Qwen3-8B-4bit',revision=revision,local_dir=str(base/'model'),allow_patterns=['*.json','*.safetensors','*.txt','*.jinja','LICENSE*','README.md'])
index=json.loads((base/'model/model.safetensors.index.json').read_text())
assert all((base/'model'/name).is_file() for name in set(index['weight_map'].values()))
(base/'ready.json').write_text(json.dumps({'model':'mlx-community/Qwen3-8B-4bit','revision':revision}))
`,base],{stdio:'inherit',env:{...process.env,HF_HUB_DISABLE_XET:'1',HF_HUB_DOWNLOAD_TIMEOUT:'120',HF_HUB_ETAG_TIMEOUT:'60'}});
console.log('Local study AI is ready. Reopen Robot Rally or check availability in Settings.');
