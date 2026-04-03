import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Handle permissions for File System Access API
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'fileSystem') {
      callback(true);
    } else {
      callback(true);
    }
  });

  // Load the index.html from a build
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
