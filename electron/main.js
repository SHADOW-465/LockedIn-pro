const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let ollamaProcess = null;

// ─── Paths ────────────────────────────────────────────────────────────────────

const resourcesPath = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, 'resources');

const ollamaBin = process.platform === 'win32'
  ? path.join(resourcesPath, 'bin', 'ollama.exe')
  : path.join(resourcesPath, 'bin', 'ollama');

const modelsPath   = path.join(resourcesPath, 'ollama-models');
const frontendDist = path.join(__dirname, 'frontend', 'dist');

// ─── Ollama Lifecycle ─────────────────────────────────────────────────────────

function startOllama() {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    if (!fs.existsSync(ollamaBin)) {
      console.warn('[Ollama] Binary not found at', ollamaBin, '— skipping (dev mode or setup not run)');
      return resolve();
    }

    console.log('[Ollama] Starting:', ollamaBin);

    ollamaProcess = spawn(ollamaBin, ['serve'], {
      env: {
        ...process.env,
        OLLAMA_MODELS:    modelsPath,
        OLLAMA_HOST:      '127.0.0.1:11434',
        OLLAMA_KEEP_ALIVE: '24h',
        // Prevent Ollama from opening a system tray icon on Windows
        OLLAMA_NO_TRAY: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    ollamaProcess.stdout?.on('data', d => process.stdout.write('[Ollama] ' + d));
    ollamaProcess.stderr?.on('data', d => process.stderr.write('[Ollama] ' + d));
    ollamaProcess.on('error', reject);
    ollamaProcess.on('exit', code => console.log('[Ollama] Exited:', code));

    // Poll until healthy
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds
    const poll = setInterval(() => {
      attempts++;
      const req = http.get('http://127.0.0.1:11434/api/tags', res => {
        if (res.statusCode === 200) {
          clearInterval(poll);
          console.log(`[Ollama] Ready (${attempts} polls)`);
          resolve();
        }
        res.resume();
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          // Don't reject — renderer shows fallback UI
          console.warn('[Ollama] Did not respond within 60s; continuing without it');
          resolve();
        }
      });
      req.setTimeout(400, () => req.destroy());
    }, 500);
  });
}

function stopOllama() {
  if (!ollamaProcess) return;
  try {
    process.platform === 'win32'
      ? require('child_process').execSync(`taskkill /pid ${ollamaProcess.pid} /f /t`)
      : ollamaProcess.kill('SIGTERM');
  } catch (e) {
    // Best effort
  }
  ollamaProcess = null;
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow camera access from file:// origin
      webSecurity: true,
    },
    icon: path.join(__dirname, '..', 'frontend', 'public', 'LockedIn-logo.png'),
  });

  const indexPath = path.join(frontendDist, 'index.html');
  mainWindow.loadFile(indexPath);

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App Events ───────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await startOllama();
  } catch (e) {
    console.error('[Ollama] Failed to start:', e.message);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  stopOllama();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', stopOllama);
app.on('will-quit', stopOllama);

// Second instance: focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('ollama-status', () => {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:11434/api/tags', res => {
      resolve({ running: res.statusCode === 200, url: 'http://127.0.0.1:11434' });
      res.resume();
    });
    req.on('error', () => resolve({ running: false, url: null }));
    req.setTimeout(2000, () => { req.destroy(); resolve({ running: false, url: null }); });
  });
});
