const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopAPI',{
 selectPresentations:()=>ipcRenderer.invoke('select-presentations'),
 checkOllama:()=>ipcRenderer.invoke('check-ollama'),
 generateOllama:payload=>ipcRenderer.invoke('generate-ollama',payload)
});
