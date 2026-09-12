"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('comiclink', {
    platform: process.platform,
    version: process.versions.electron,
    window: {
        minimize: () => electron_1.ipcRenderer.send('window-minimize'),
        maximize: () => electron_1.ipcRenderer.send('window-maximize'),
        close: () => electron_1.ipcRenderer.send('window-close'),
    }
});
//# sourceMappingURL=preload.js.map