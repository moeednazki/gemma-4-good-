const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// 1. SETUP LOGGING (Crucial for debugging silent OTA failures)
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('FMS Mainframe starting...');

let mainWindow;
let splashWindow;

function createWindow() {
  // 1. CREATE THE SPLASH SCREEN
  splashWindow = new BrowserWindow({
    width: 800,
    height: 800,
    transparent: true, // Allows the rounded HTML container to look like a floating widget
    frame: false,      // Removes the Windows close/minimize top bar
    alwaysOnTop: true,
    icon: path.join(__dirname, 'dist', 'splash-logo.png')
  });

  splashWindow.loadFile(path.join(__dirname, 'dist', 'splash.html'));

  // 2. CREATE THE MAIN WINDOW (BUT KEEP IT HIDDEN)
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: "FMS Pro",
    autoHideMenuBar: true, 
    show: false, // <-- CRITICAL: Do not show this yet!
    icon: path.join(__dirname, 'dist', 'splash'), 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load Vite Dev Server in development, or built files in production
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // 3. THE SWAP LOGIC
  mainWindow.once('ready-to-show', () => {
    // Wait an extra 5 seconds so they can admire your logo
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy(); 
      mainWindow.show();      
      mainWindow.maximize();  
    }, 5000); 
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// =========================================================================
// ENTERPRISE OVER-THE-AIR (OTA) UPDATE ENGINE
// =========================================================================

// Listen for the trigger from your React UI (SystemEcosystem.jsx)
ipcMain.on('trigger-background-update', (event, updateUrl) => {
  log.info(`Update signal received. Target URL: ${updateUrl}`);
  
  // Set the feed URL (This should point to the FOLDER containing latest.yml)
  if (updateUrl && updateUrl.startsWith('http')) {
     autoUpdater.setFeedURL({
       provider: 'generic',
       url: updateUrl
     });
  }

  // Start the background check and download process
  autoUpdater.checkForUpdates();
});

// --- COMMUNICATION BRIDGE TO REACT UI ---

autoUpdater.on('checking-for-update', () => {
  log.info('Checking cloud storage for update manifest...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update found! Starting background download...');
  if (mainWindow) mainWindow.webContents.send('ota-message', 'Update found! Downloading in background...');
});

autoUpdater.on('update-not-available', (info) => {
  log.info('System is up to date.');
  if (mainWindow) mainWindow.webContents.send('ota-error', 'System is already up to date.');
});

autoUpdater.on('error', (err) => {
  log.error('OTA Error: ' + err);
  if (mainWindow) mainWindow.webContents.send('ota-error', err.toString());
});

// Sends live download progress back to React so your progress bar moves!
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = `Speed: ${Math.round(progressObj.bytesPerSecond / 1000)} KB/s - Downloaded ${Math.round(progressObj.percent)}%`;
  log.info(log_message);
  
  if (mainWindow) mainWindow.webContents.send('ota-progress', Math.round(progressObj.percent));
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded successfully. Restarting app to apply patch.');
  if (mainWindow) mainWindow.webContents.send('ota-message', 'Download complete! Restarting system to install...');
  
  // Wait 3 seconds so the user can read the success message, then reboot
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 3000);
});