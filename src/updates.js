"use strict";
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Transform, Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const repo = "AmadeusJackson/Robot-Rally-Learner";
const endpoint = "https://api.github.com/repos/" + repo + "/releases/latest";
const limit = 512 * 1024 * 1024;
const versionPattern = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

function selectInstaller(release, current, arch) {
  const tag = release.tag_name;
  const version = typeof tag === "string" && tag.startsWith("v") ? tag.slice(1) : "";
  if (release.draft || release.prerelease || !versionPattern.test(version) || !versionPattern.test(current))
    throw Error("GitHub returned an unsupported release version.");
  const installed = current.split(".").map(Number);
  const difference = version.split(".").map((part,i) => Number(part)-installed[i]).find(n => n !== 0);
  if (!difference || difference < 0) return null;
  if (!["arm64","x64"].includes(arch)) throw Error("This Mac architecture is unsupported.");
  const name = 'Robot-Rally-Learning-' + version + '-' + arch + '.dmg';
  const url = 'https://github.com/' + repo + '/releases/download/' + tag + '/' + name;
  const asset = release.assets?.find(item => item.name === name && item.browser_download_url === url);
  if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > limit ||
      !/^sha256:[0-9a-f]{64}$/.test(asset.digest))
    throw Error("This release does not yet have a verifiable installer for your Mac.");
  return {version,name,url,size:asset.size,digest:asset.digest};
}

function createUpdater({version, arch, directory, openPath, request=fetch}) {
  let available, busy=false;
  async function exclusive(fn) {
    if (busy) throw Error("An update check or download is already running.");
    busy=true;
    try { return await fn(); } finally { busy=false; }
  }
  return {
    check: () => exclusive(async () => {
      available=null;
      const response=await request(endpoint,{headers:{Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(15000)});
      if (response.status===404) return {message:'Installed version '+version+'. No GitHub releases have been published yet.'};
      if (!response.ok) throw Error('GitHub could not check for updates (HTTP '+response.status+'). Try again later.');
      available=selectInstaller(await response.json(),version,arch);
      return available ? {available:true,message:'Version '+available.version+' is available ('+Math.ceil(available.size/1048576)+' MB).'} :
        {message:'Version '+version+' is up to date.'};
    }),
    download: () => exclusive(async () => {
      if (!available) throw Error("Check for an update first.");
      const asset=available;
      await fs.promises.mkdir(directory,{recursive:true});
      const folder=await fs.promises.mkdtemp(path.join(directory,"release-"));
      const target=path.join(folder,asset.name);
      try {
        const response=await request(asset.url,{signal:AbortSignal.timeout(60*60*1000)});
        if (!response.ok || !response.body) throw Error("GitHub could not download the installer. Try again.");
        let bytes=0;
        const hash=createHash('sha256');
        const verify=new Transform({transform(chunk,encoding,done){
          bytes+=chunk.length;
          if(bytes>asset.size) return done(Error("Installer exceeds the published size."));
          hash.update(chunk); done(null,chunk);
        }});
        await pipeline(Readable.fromWeb(response.body),verify,fs.createWriteStream(target,{flags:'wx',mode:0o600}));
        if(bytes!==asset.size || 'sha256:'+hash.digest('hex')!==asset.digest) throw Error("Installer verification failed. Please download it again.");
        const error=await openPath(target);
        if(error) throw Error("macOS could not open the installer.");
        return {message:"Installer open. Finish your current game, quit Robot Rally, then drag the new app into Applications and choose Replace if prompted."};
      } catch(error) {
        await fs.promises.rm(folder,{recursive:true,force:true});
        throw error;
      }
    })
  };
}
module.exports={createUpdater,selectInstaller};
