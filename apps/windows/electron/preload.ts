import { contextBridge, ipcRenderer } from 'electron';
import * as os from 'os';

contextBridge.exposeInMainWorld('comiclink', {
  platform: os.platform(),
  version: process.versions.electron,
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  }
});
