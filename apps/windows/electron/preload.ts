import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('comiclink', {
  platform: process.platform,
  version: process.versions.electron,
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  }
});
