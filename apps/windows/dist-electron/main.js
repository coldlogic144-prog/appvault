"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0a1128',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[Electron] Renderer loaded successfully');
    });
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error(`[Electron] Renderer failed to load: ${errorDescription} (${errorCode})`);
    });
    mainWindow.webContents.on('console-message', (_event, level, message) => {
        console.log(`[Renderer Console level ${level}]: ${message}`);
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173').catch(() => {
            console.log('[Electron] Dev server not reachable, falling back to dist-renderer');
            mainWindow.loadFile(path_1.default.join(__dirname, '../dist-renderer/index.html'));
        });
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist-renderer/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', function () {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// Window controls IPC
electron_1.ipcMain.on('window-minimize', (event) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (win)
        win.minimize();
});
electron_1.ipcMain.on('window-maximize', (event) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        }
        else {
            win.maximize();
        }
    }
});
electron_1.ipcMain.on('window-close', (event) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (win)
        win.close();
});
//# sourceMappingURL=main.js.map