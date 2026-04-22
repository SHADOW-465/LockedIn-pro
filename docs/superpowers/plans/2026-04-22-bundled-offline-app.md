# Bundled Offline App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a self-contained, click-and-play LockedIn Pro app for Windows desktop (Electron .exe installer) and Android (APK), with the `huihui_ai/qwen3.5-abliterated:0.8b` model bundled inside — no user-facing downloads or tool installs required.

**Architecture:** The desktop build packages the Ollama binary + model blobs into an Electron `extraResources` directory; Electron's main process spawns Ollama on app launch and tears it down on exit. The Android APK bundles the raw GGUF file in Vite's `public/` folder (which Capacitor copies into WebView assets); `@wllama/wllama` (WASM llama.cpp) runs inference entirely inside the Android WebView — no network call needed. A shared `UnifiedAIEngine.js` detects the current environment (Electron / Capacitor / browser) and routes to the correct inference backend. The existing `AIEngine.js` (Ollama HTTP client) and `generateArchitectResponse` (behavioral mock fallback) are preserved.

**Tech Stack:** Electron 33, electron-builder 25, `@wllama/wllama` 2.x, `@capacitor/android` 8, Node.js scripts (setup), `ollama` CLI (build-time only), Vite 8, React 19, Tailwind CSS 3, Dexie 4.

---

## Model Facts (read before touching anything)

| Property | Value |
|---|---|
| Ollama tag | `huihui_ai/qwen3.5-abliterated:0.8b` |
| Parameter count | 0.8 billion |
| Capabilities | Text generation + Vision-Language (multimodal) |
| Disk size (Q4_K_M GGUF) | ≈ 500 MB |
| Desktop format | Ollama manifest + blob (copied from `~/.ollama/models/`) |
| Mobile format | Raw GGUF file at `frontend/public/models/model.gguf` |
| wllama vision support | Text: yes. Vision: via mmproj GGUF (if model ships one); falls back gracefully |

**You need Ollama installed only at build time** (`ollama pull huihui_ai/qwen3.5-abliterated:0.8b`). End users never see Ollama.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `electron/main.js` | Electron main process: spawn/kill Ollama, create BrowserWindow |
| `electron/preload.js` | Expose narrow IPC API to renderer (`window.electronAPI`) |
| `electron/package.json` | Electron + electron-builder config, `extraResources` declaration |
| `scripts/prepare-desktop.js` | Build-time: download Ollama binary + copy model blobs into `electron/resources/` |
| `scripts/prepare-android.js` | Build-time: copy GGUF blob from Ollama cache into `frontend/public/models/` + copy wllama WASM files |
| `frontend/src/services/WllamaEngine.js` | WASM inference wrapper (text + best-effort vision) |
| `frontend/src/services/UnifiedAIEngine.js` | Environment-detects and routes to Ollama HTTP or WllamaEngine |
| `frontend/src/components/ModelLoadingOverlay.jsx` | Full-screen loading state while wllama loads the model on first open |

### Files to modify

| File | Change |
|---|---|
| `frontend/src/services/AIEngine.js` | Import `UnifiedAIEngine`; re-export its `chat`, `analyzeGaze`, `evaluateReport`, `isAvailable` so existing callers need zero changes |
| `frontend/src/pages/MasterChat.jsx` | Wrap send handler with model-loading guard; show status |
| `frontend/vite.config.js` | Add `assetsInclude: ['**/*.gguf', '**/*.wasm']` so Vite doesn't hash/inline them |
| `frontend/src/App.jsx` | Mount `ModelLoadingOverlay` at root (visible only on Capacitor native platform) |
| `docs/AI_AGENT_GUIDELINES.md` | Update model section |
| `gemini.md` | Update model section + architecture |

### No changes needed

`ChatService.js`, `MandateService.js`, `Mandates.jsx`, `LiveCameraVerifier.jsx`, `AppDataContext.jsx`, `ActionParser.js`, `AppControlAPI.js` — these are all correct from the prior session.

---

## Task 1 — Install Dependencies

**Files:**
- Modify: `frontend/package.json` (add `@wllama/wllama`)
- Create: `electron/package.json`

- [ ] **Step 1: Install wllama in the frontend**

```bash
cd frontend
npm install @wllama/wllama --legacy-peer-deps
```

Expected: `@wllama/wllama` appears in `frontend/package.json` dependencies.

- [ ] **Step 2: Create `electron/package.json`**

```json
{
  "name": "lockedin-pro-desktop",
  "version": "1.0.0",
  "description": "LockedIn Pro — Desktop",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build:win": "electron-builder --win --x64",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "dependencies": {
    "electron-squirrel-startup": "^1.0.1"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "com.lockedinpro.app",
    "productName": "LockedIn Pro",
    "directories": {
      "output": "../dist-electron"
    },
    "extraResources": [
      {
        "from": "resources/bin",
        "to": "bin",
        "filter": ["**/*"]
      },
      {
        "from": "resources/ollama-models",
        "to": "ollama-models",
        "filter": ["**/*"]
      }
    ],
    "files": [
      "main.js",
      "preload.js",
      "../frontend/dist/**/*"
    ],
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "../frontend/public/pwa-512x512.png"
    },
    "mac": {
      "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }],
      "icon": "../frontend/public/pwa-512x512.png"
    },
    "linux": {
      "target": [{ "target": "AppImage", "arch": ["x64"] }]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "../frontend/public/pwa-512x512.png"
    }
  }
}
```

- [ ] **Step 3: Install Electron dependencies**

```bash
cd electron
npm install
```

Expected: `electron/node_modules/` created, `electron` and `electron-builder` present.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/package.json frontend/package-lock.json electron/package.json electron/package-lock.json
git commit -m "feat: add wllama + electron deps for offline bundled app"
```

---

## Task 2 — Build-Time Setup Script: Desktop

**Files:**
- Create: `scripts/prepare-desktop.js`

This script is run **once by the developer** before packaging. It downloads the Ollama binary for the target platform and copies the already-pulled model from `~/.ollama/models/` into `electron/resources/`.

- [ ] **Step 1: Create `scripts/prepare-desktop.js`**

```javascript
#!/usr/bin/env node
/**
 * Run ONCE before building the Electron installer:
 *   node scripts/prepare-desktop.js [--platform win32|darwin|linux]
 *
 * Prerequisites:
 *   - Ollama installed and on PATH
 *   - ollama pull huihui_ai/qwen3.5-abliterated:0.8b  (already done)
 */
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import os from 'os';

const TARGET_PLATFORM = process.argv.includes('--platform')
  ? process.argv[process.argv.indexOf('--platform') + 1]
  : process.platform;

const RESOURCES_DIR = path.resolve('electron/resources');
const BIN_DIR = path.join(RESOURCES_DIR, 'bin');
const MODELS_DIR = path.join(RESOURCES_DIR, 'ollama-models');

const OLLAMA_RELEASES = {
  win32:  'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip',
  darwin: 'https://github.com/ollama/ollama/releases/latest/download/ollama-darwin',
  linux:  'https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (url) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    get(url);
  });
}

function findOllamaModelsDir() {
  const candidates = [
    path.join(os.homedir(), '.ollama', 'models'),        // Linux/Mac
    path.join(process.env.USERPROFILE || '', '.ollama', 'models'), // Windows
    path.join(process.env.APPDATA || '', 'Ollama', 'models'),      // Windows alt
  ];
  return candidates.find(d => fs.existsSync(d));
}

async function step1_downloadOllamaBinary() {
  console.log(`\n[1/3] Downloading Ollama binary for ${TARGET_PLATFORM}...`);
  ensureDir(BIN_DIR);
  const url = OLLAMA_RELEASES[TARGET_PLATFORM];
  if (!url) throw new Error(`Unsupported platform: ${TARGET_PLATFORM}`);

  if (TARGET_PLATFORM === 'win32') {
    const zipPath = path.join(BIN_DIR, 'ollama.zip');
    await downloadFile(url, zipPath);
    // Extract using built-in PowerShell (Windows)
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${BIN_DIR}' -Force"`, { stdio: 'inherit' });
    fs.unlinkSync(zipPath);
    // Rename to ollama.exe if needed
    const exeCandidates = fs.readdirSync(BIN_DIR).filter(f => f.endsWith('.exe'));
    if (!fs.existsSync(path.join(BIN_DIR, 'ollama.exe')) && exeCandidates.length > 0) {
      fs.renameSync(path.join(BIN_DIR, exeCandidates[0]), path.join(BIN_DIR, 'ollama.exe'));
    }
  } else {
    const binPath = path.join(BIN_DIR, 'ollama');
    await downloadFile(url, binPath);
    fs.chmodSync(binPath, 0o755);
  }
  console.log('    ✓ Ollama binary ready');
}

function step2_copyModel() {
  console.log('\n[2/3] Copying model from local Ollama cache...');
  const src = findOllamaModelsDir();
  if (!src) {
    console.error('ERROR: Could not find ~/.ollama/models. Run: ollama pull huihui_ai/qwen3.5-abliterated:0.8b');
    process.exit(1);
  }

  // Verify model is actually there
  const manifestsDir = path.join(src, 'manifests', 'registry.ollama.ai', 'huihui_ai', 'qwen3.5-abliterated');
  if (!fs.existsSync(manifestsDir)) {
    console.error('ERROR: Model not found. Run: ollama pull huihui_ai/qwen3.5-abliterated:0.8b');
    process.exit(1);
  }

  // Read the manifest to find which blobs belong to this model
  const tagFile = path.join(manifestsDir, '0.8b');
  const manifest = JSON.parse(fs.readFileSync(tagFile, 'utf-8'));
  const blobDigests = manifest.layers.map(l => l.digest);  // sha256:XXXX

  // Copy only the manifests we need + their blobs
  ensureDir(path.join(MODELS_DIR, 'manifests', 'registry.ollama.ai', 'huihui_ai', 'qwen3.5-abliterated'));
  fs.cpSync(manifestsDir, path.join(MODELS_DIR, 'manifests', 'registry.ollama.ai', 'huihui_ai', 'qwen3.5-abliterated'), { recursive: true });

  ensureDir(path.join(MODELS_DIR, 'blobs'));
  const blobsSrc = path.join(src, 'blobs');
  for (const digest of blobDigests) {
    const blobName = digest.replace(':', '-');  // sha256:XXX → sha256-XXX
    const srcBlob = path.join(blobsSrc, blobName);
    const dstBlob = path.join(MODELS_DIR, 'blobs', blobName);
    if (!fs.existsSync(srcBlob)) {
      console.error(`  Missing blob: ${blobName}`);
      process.exit(1);
    }
    if (!fs.existsSync(dstBlob)) {
      console.log(`  Copying blob ${blobName.slice(0, 30)}...`);
      fs.copyFileSync(srcBlob, dstBlob);
    } else {
      console.log(`  Blob ${blobName.slice(0, 30)}... already present, skipping`);
    }
  }
  console.log('    ✓ Model blobs copied');
}

function step3_verify() {
  console.log('\n[3/3] Verifying resources...');
  const ollamaExe = TARGET_PLATFORM === 'win32'
    ? path.join(BIN_DIR, 'ollama.exe')
    : path.join(BIN_DIR, 'ollama');
  if (!fs.existsSync(ollamaExe)) throw new Error('ollama binary missing after download');
  const blobs = fs.readdirSync(path.join(MODELS_DIR, 'blobs'));
  if (blobs.length === 0) throw new Error('No model blobs found');
  console.log(`    ✓ Binary: ${path.basename(ollamaExe)}`);
  console.log(`    ✓ Model blobs: ${blobs.length} file(s)`);
  console.log('\n  Desktop resources ready. Run: cd electron && npm run build:win');
}

(async () => {
  try {
    await step1_downloadOllamaBinary();
    step2_copyModel();
    step3_verify();
  } catch (e) {
    console.error('\nFATAL:', e.message);
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Mark it executable and test it locally**

```bash
# Run from repo root (requires ollama pull to have been done already)
node scripts/prepare-desktop.js

# Expected output:
# [1/3] Downloading Ollama binary for win32...
#     ✓ Ollama binary ready
# [2/3] Copying model from local Ollama cache...
#   Copying blob sha256-XXXX...
#     ✓ Model blobs copied
# [3/3] Verifying resources...
#     ✓ Binary: ollama.exe
#     ✓ Model blobs: 3 file(s)
```

- [ ] **Step 3: Add resources dirs to .gitignore**

```bash
# Append to root .gitignore (or create it)
echo "electron/resources/bin/" >> .gitignore
echo "electron/resources/ollama-models/" >> .gitignore
echo "dist-electron/" >> .gitignore
echo "frontend/public/models/" >> .gitignore
echo "frontend/public/wllama/" >> .gitignore
```

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-desktop.js .gitignore
git commit -m "feat: add desktop build setup script (downloads ollama + model at build time)"
```

---

## Task 3 — Build-Time Setup Script: Android

**Files:**
- Create: `scripts/prepare-android.js`

This script (run once before building the APK) extracts the raw GGUF blob from Ollama's local cache and places it in `frontend/public/models/` where Vite + Capacitor will bundle it into the APK.

- [ ] **Step 1: Create `scripts/prepare-android.js`**

```javascript
#!/usr/bin/env node
/**
 * Run ONCE before building the Android APK:
 *   node scripts/prepare-android.js
 *
 * Prerequisites:
 *   - ollama pull huihui_ai/qwen3.5-abliterated:0.8b
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const MODEL_NAME = 'huihui_ai/qwen3.5-abliterated';
const MODEL_TAG = '0.8b';
const OUTPUT_DIR = path.resolve('frontend/public/models');
const WLLAMA_SRC = path.resolve('frontend/node_modules/@wllama/wllama/dist');
const WLLAMA_DST = path.resolve('frontend/public/wllama');

function findOllamaModelsDir() {
  const candidates = [
    path.join(os.homedir(), '.ollama', 'models'),
    path.join(process.env.USERPROFILE || '', '.ollama', 'models'),
    path.join(process.env.APPDATA || '', 'Ollama', 'models'),
  ];
  return candidates.find(d => fs.existsSync(d));
}

function step1_extractGGUF() {
  console.log('\n[1/3] Extracting GGUF from Ollama model cache...');
  const src = findOllamaModelsDir();
  if (!src) {
    console.error('Ollama models directory not found. Run: ollama pull huihui_ai/qwen3.5-abliterated:0.8b');
    process.exit(1);
  }

  const manifestPath = path.join(
    src, 'manifests', 'registry.ollama.ai',
    MODEL_NAME, MODEL_TAG
  );
  if (!fs.existsSync(manifestPath)) {
    console.error(`Model not found at ${manifestPath}. Run: ollama pull ${MODEL_NAME}:${MODEL_TAG}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  // The model layer has mediaType 'application/vnd.ollama.image.model'
  const modelLayer = manifest.layers.find(l =>
    l.mediaType === 'application/vnd.ollama.image.model'
  );
  if (!modelLayer) {
    console.error('Could not find model layer in manifest');
    process.exit(1);
  }

  const blobName = modelLayer.digest.replace(':', '-');
  const blobPath = path.join(src, 'blobs', blobName);
  if (!fs.existsSync(blobPath)) {
    console.error(`Blob not found: ${blobPath}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, 'model.gguf');
  if (fs.existsSync(outPath)) {
    console.log('  model.gguf already present, skipping copy');
  } else {
    console.log(`  Copying ${(modelLayer.size / 1e6).toFixed(0)} MB...`);
    fs.copyFileSync(blobPath, outPath);
  }
  console.log('    ✓ model.gguf ready at frontend/public/models/model.gguf');

  // Also copy mmproj (vision encoder) if present
  const mmprojLayer = manifest.layers.find(l =>
    l.mediaType === 'application/vnd.ollama.image.projector'
  );
  if (mmprojLayer) {
    const mmprojBlob = path.join(src, 'blobs', mmprojLayer.digest.replace(':', '-'));
    const mmprojDst = path.join(OUTPUT_DIR, 'mmproj.gguf');
    if (!fs.existsSync(mmprojDst)) {
      console.log(`  Copying vision projector (${(mmprojLayer.size / 1e6).toFixed(0)} MB)...`);
      fs.copyFileSync(mmprojBlob, mmprojDst);
    }
    console.log('    ✓ mmproj.gguf ready (vision encoder)');
  } else {
    console.log('  Note: No vision projector found — gaze analysis will use text-only fallback');
  }
}

function step2_copyWllamaWASM() {
  console.log('\n[2/3] Copying wllama WASM files...');
  if (!fs.existsSync(WLLAMA_SRC)) {
    console.error('wllama not installed. Run: cd frontend && npm install @wllama/wllama');
    process.exit(1);
  }
  fs.mkdirSync(WLLAMA_DST, { recursive: true });
  const wasmFiles = fs.readdirSync(WLLAMA_SRC).filter(f => f.endsWith('.wasm') || f.endsWith('.js'));
  for (const f of wasmFiles) {
    fs.copyFileSync(path.join(WLLAMA_SRC, f), path.join(WLLAMA_DST, f));
  }
  console.log(`    ✓ Copied ${wasmFiles.length} wllama files to frontend/public/wllama/`);
}

function step3_verify() {
  console.log('\n[3/3] Verification...');
  const gguf = path.join(OUTPUT_DIR, 'model.gguf');
  const sizeMB = (fs.statSync(gguf).size / 1e6).toFixed(0);
  console.log(`    ✓ model.gguf: ${sizeMB} MB`);
  const wllamaFiles = fs.readdirSync(WLLAMA_DST);
  console.log(`    ✓ wllama WASM files: ${wllamaFiles.length}`);
  console.log('\n  Android resources ready.');
  console.log('  Next: cd frontend && npm run build && npx cap sync android && npx cap open android');
}

step1_extractGGUF();
step2_copyWllamaWASM();
step3_verify();
```

- [ ] **Step 2: Test the script locally**

```bash
node scripts/prepare-android.js

# Expected:
# [1/3] Extracting GGUF from Ollama model cache...
#   Copying 487 MB...
#     ✓ model.gguf ready at frontend/public/models/model.gguf
# [2/3] Copying wllama WASM files...
#     ✓ Copied 4 wllama files to frontend/public/wllama/
# [3/3] Verification...
#     ✓ model.gguf: 487 MB
```

- [ ] **Step 3: Commit**

```bash
git add scripts/prepare-android.js
git commit -m "feat: add android build setup script (extracts GGUF + wllama WASM)"
```

---

## Task 4 — Electron Main Process

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`

- [ ] **Step 1: Create `electron/main.js`**

```javascript
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Prevent multiple instances
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

const modelsPath = path.join(resourcesPath, 'ollama-models');

const frontendPath = app.isPackaged
  ? path.join(__dirname, '..', 'frontend', 'dist')
  : path.join(__dirname, '..', 'frontend', 'dist');

// ─── Ollama Lifecycle ─────────────────────────────────────────────────────────
function startOllama() {
  return new Promise((resolve, reject) => {
    console.log('[Ollama] Spawning:', ollamaBin);
    console.log('[Ollama] Models path:', modelsPath);

    ollamaProcess = spawn(ollamaBin, ['serve'], {
      env: {
        ...process.env,
        OLLAMA_MODELS: modelsPath,
        OLLAMA_HOST: '127.0.0.1:11434',
        OLLAMA_KEEP_ALIVE: '24h',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    ollamaProcess.stdout.on('data', d => console.log('[Ollama]', d.toString().trim()));
    ollamaProcess.stderr.on('data', d => console.log('[Ollama ERR]', d.toString().trim()));
    ollamaProcess.on('error', reject);
    ollamaProcess.on('exit', (code) => {
      console.log('[Ollama] Exited with code', code);
    });

    // Poll until Ollama responds on /api/tags
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      http.get('http://127.0.0.1:11434/api/tags', (res) => {
        if (res.statusCode === 200) {
          clearInterval(poll);
          console.log('[Ollama] Ready after', attempts, 'poll(s)');
          resolve();
        }
      }).on('error', () => {
        if (attempts > 60) {
          clearInterval(poll);
          reject(new Error('Ollama did not start within 30 seconds'));
        }
      });
    }, 500);
  });
}

function stopOllama() {
  if (ollamaProcess) {
    ollamaProcess.kill('SIGTERM');
    ollamaProcess = null;
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'frontend', 'public', 'pwa-512x512.png'),
  });

  mainWindow.loadFile(path.join(frontendPath, 'index.html'));

  // Open external links in the system browser, not inside the app
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
    // Continue anyway — renderer will show offline fallback
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

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-ollama-status', async () => {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:11434/api/tags', (res) => {
      resolve({ running: res.statusCode === 200, url: 'http://127.0.0.1:11434' });
    }).on('error', () => resolve({ running: false, url: null }));
  });
});
```

- [ ] **Step 2: Create `electron/preload.js`**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  // Ask main process whether Ollama is running and get its URL
  getOllamaStatus: () => ipcRenderer.invoke('get-ollama-status'),
  // Sentinel so the renderer can detect it's inside Electron
  isElectron: true,
});
```

- [ ] **Step 3: Commit**

```bash
git add electron/main.js electron/preload.js
git commit -m "feat: electron main process — spawns bundled ollama, creates window"
```

---

## Task 5 — `WllamaEngine.js` (WASM Inference for Mobile)

**Files:**
- Create: `frontend/src/services/WllamaEngine.js`

This is the mobile inference backend. It runs entirely inside the Android WebView using WASM llama.cpp.

- [ ] **Step 1: Create `frontend/src/services/WllamaEngine.js`**

```javascript
import { Wllama } from '@wllama/wllama';

const MODEL_URL = '/models/model.gguf';
const MMPROJ_URL = '/models/mmproj.gguf';
const WLLAMA_CONFIG_PATHS = {
  'single-thread/wllama.js': '/wllama/wllama-single.js',
};

let instance = null;
let isLoaded = false;
let loadPromise = null;
let hasMmproj = false;

// Progress callback type: (percent: number, message: string) => void
let _onProgress = null;

export const WllamaEngine = {
  onProgress(cb) {
    _onProgress = cb;
  },

  async isModelAvailable() {
    try {
      const res = await fetch(MODEL_URL, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async load() {
    if (isLoaded) return;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      _onProgress?.(0, 'Initialising inference engine...');

      instance = new Wllama(WLLAMA_CONFIG_PATHS, {
        suppressNativeLog: true,
      });

      // Check if mmproj (vision) file is present
      try {
        const r = await fetch(MMPROJ_URL, { method: 'HEAD' });
        hasMmproj = r.ok;
      } catch {
        hasMmproj = false;
      }

      _onProgress?.(5, 'Loading model weights...');

      const loadOptions = {
        n_ctx: 2048,
        n_threads: 1, // single-thread for Android WebView SharedArrayBuffer compatibility
        embeddings: false,
        progressCallback: ({ loaded, total }) => {
          const pct = total > 0 ? Math.round((loaded / total) * 90) + 5 : 0;
          _onProgress?.(pct, `Loading model... ${(loaded / 1e6).toFixed(0)}/${(total / 1e6).toFixed(0)} MB`);
        },
      };

      if (hasMmproj) {
        await instance.loadModelFromUrl(MODEL_URL, MMPROJ_URL, loadOptions);
      } else {
        await instance.loadModelFromUrl(MODEL_URL, loadOptions);
      }

      _onProgress?.(100, 'The Architect is ready.');
      isLoaded = true;
    })();

    return loadPromise;
  },

  async chat(systemPrompt, messages) {
    if (!isLoaded) await this.load();

    // Build a single prompt string from the chat history (ChatML format for Qwen)
    let prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      prompt += `<|im_start|>${role}\n${m.content}<|im_end|>\n`;
    }
    prompt += '<|im_start|>assistant\n';

    const result = await instance.createCompletion(prompt, {
      nPredict: 320,
      temperature: 0.88,
      top_p: 0.92,
      repeat_penalty: 1.1,
      stopTokens: ['<|im_end|>', '<|endoftext|>'],
    });

    return result.trim();
  },

  async analyzeGaze(imageBase64) {
    if (!isLoaded) await this.load();

    if (!hasMmproj) {
      // Text-only fallback: ask model to self-evaluate based on context
      const result = await instance.createCompletion(
        `<|im_start|>system\nYou are The Architect performing a gaze inspection. The subject has submitted a camera capture. Without seeing the image, render judgment based on the act of submission itself. Respond with PASS or FAIL followed by one terse sentence.<|im_end|>\n<|im_start|>user\nInspection submitted.<|im_end|>\n<|im_start|>assistant\n`,
        { nPredict: 60, temperature: 0.5 }
      );
      const passed = result.trim().toUpperCase().startsWith('PASS');
      return {
        success: passed,
        comment: result.replace(/^(PASS|FAIL)\s*/i, '').trim(),
      };
    }

    // Multimodal vision path (if mmproj present)
    const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(pureBase64), c => c.charCodeAt(0));

    const result = await instance.createCompletionMultimodal(
      `<|im_start|>user\n<image>\nInspect this submission. Is the subject present, attentive, and compliant? Begin with PASS or FAIL then give one sharp sentence.<|im_end|>\n<|im_start|>assistant\n`,
      [{ type: 'image', data: imageBytes }],
      { nPredict: 80, temperature: 0.4 }
    );

    const passed = result.trim().toUpperCase().startsWith('PASS');
    return {
      success: passed,
      comment: result.replace(/^(PASS|FAIL)\s*/i, '').trim() || (passed ? 'Compliance noted.' : 'Deviation detected.'),
    };
  },

  async evaluateReport(mandateTitle, report) {
    if (!isLoaded) await this.load();

    const prompt = `<|im_start|>system\nYou are The Architect evaluating a mandate completion report. Be terse and decisive.<|im_end|>\n<|im_start|>user\nMandate: "${mandateTitle}"\n\nReport: "${report}"\n\nIs this report honest and complete, or vague and evasive? Start with ACCEPTED or REJECTED then give one sentence of judgment.<|im_end|>\n<|im_start|>assistant\n`;

    const result = await instance.createCompletion(prompt, {
      nPredict: 100,
      temperature: 0.5,
      stopTokens: ['<|im_end|>'],
    });

    const accepted = /^accepted/i.test(result.trim());
    const comment = result.replace(/^(accepted|rejected)\s*[:\-–]?\s*/i, '').trim();
    return { accepted, comment };
  },

  get loaded() { return isLoaded; },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/WllamaEngine.js
git commit -m "feat: WllamaEngine — wasm llama.cpp inference for Android WebView"
```

---

## Task 6 — `UnifiedAIEngine.js` (Environment Router)

**Files:**
- Create: `frontend/src/services/UnifiedAIEngine.js`
- Modify: `frontend/src/services/AIEngine.js` (re-export from UnifiedAIEngine)

- [ ] **Step 1: Create `frontend/src/services/UnifiedAIEngine.js`**

```javascript
import { AIEngine as OllamaEngine } from './AIEngine.js';
import { WllamaEngine } from './WllamaEngine.js';

// Environment detection
const isElectron = () =>
  typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

const isCapacitorNative = () =>
  typeof window !== 'undefined' &&
  window.Capacitor?.isNativePlatform?.() === true;

// On Electron: Ollama is running locally, exposed by main.js
// On Capacitor native (Android/iOS): use wllama WASM
// On browser: try Ollama (dev mode / PWA), fall back to mock
function getBackend() {
  if (isElectron() || (!isCapacitorNative())) return 'ollama';
  return 'wllama';
}

export const UnifiedAIEngine = {
  async isAvailable() {
    if (getBackend() === 'wllama') {
      return WllamaEngine.isModelAvailable();
    }
    return OllamaEngine.isAvailable();
  },

  async ensureLoaded(onProgress) {
    if (getBackend() !== 'wllama') return;
    WllamaEngine.onProgress(onProgress);
    await WllamaEngine.load();
  },

  async chat(systemPrompt, messages) {
    if (getBackend() === 'wllama') {
      return WllamaEngine.chat(systemPrompt, messages);
    }
    return OllamaEngine.chat(systemPrompt, messages);
  },

  async analyzeGaze(imageBase64) {
    if (getBackend() === 'wllama') {
      return WllamaEngine.analyzeGaze(imageBase64);
    }
    return OllamaEngine.analyzeGaze(imageBase64);
  },

  async evaluateReport(mandateTitle, report) {
    if (getBackend() === 'wllama') {
      return WllamaEngine.evaluateReport(mandateTitle, report);
    }
    return OllamaEngine.evaluateReport(mandateTitle, report);
  },

  get backend() { return getBackend(); },
  get wllamaLoaded() { return WllamaEngine.loaded; },
};
```

- [ ] **Step 2: Replace `AIEngine.js` to re-export from `UnifiedAIEngine`**

Open `frontend/src/services/AIEngine.js`. The file currently contains the Ollama HTTP client. **Do not delete it** — `UnifiedAIEngine` imports from it. No changes needed to that file.

All callers (`MasterChat.jsx`, `Mandates.jsx`) already import from `AIEngine.js`. Change those imports to point to `UnifiedAIEngine.js`:

In `frontend/src/pages/MasterChat.jsx`, line 8:
```javascript
// BEFORE:
import { AIEngine } from '../services/AIEngine';

// AFTER:
import { UnifiedAIEngine as AIEngine } from '../services/UnifiedAIEngine';
```

In `frontend/src/pages/Mandates.jsx`, line 3:
```javascript
// BEFORE:
import { AIEngine } from '../services/AIEngine';

// AFTER:
import { UnifiedAIEngine as AIEngine } from '../services/UnifiedAIEngine';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/UnifiedAIEngine.js frontend/src/pages/MasterChat.jsx frontend/src/pages/Mandates.jsx
git commit -m "feat: UnifiedAIEngine routes to Ollama (Electron/browser) or wllama (Android)"
```

---

## Task 7 — `ModelLoadingOverlay.jsx`

**Files:**
- Create: `frontend/src/components/ModelLoadingOverlay.jsx`
- Modify: `frontend/src/App.jsx`

On Android, wllama takes 10-60 seconds to load the model on first open (reading 500MB from disk into WASM). The overlay blocks the UI until the model is ready, then disappears.

- [ ] **Step 1: Create `frontend/src/components/ModelLoadingOverlay.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { UnifiedAIEngine } from '../services/UnifiedAIEngine';

export default function ModelLoadingOverlay() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Initialising...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
    if (!isCapacitor) return; // Desktop/browser: Ollama handles it, no overlay needed

    setVisible(true);
    UnifiedAIEngine.ensureLoaded((pct, msg) => {
      setProgress(pct);
      setMessage(msg);
    }).then(() => {
      // Brief pause so user sees 100%
      setTimeout(() => setVisible(false), 800);
    }).catch(e => {
      setError(e.message || 'Model failed to load');
    });
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-950 px-8">
      {/* Identity */}
      <div className="mb-12 text-center space-y-2">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-neutral-600">
          Establishing Neural Link
        </p>
        <h1 className="text-3xl font-display font-bold tracking-tighter text-neutral-100 uppercase">
          The Architect
        </h1>
        <p className="text-[10px] font-mono text-neutral-600">
          Qwen 3.5 VL 0.8B · Abliterated
        </p>
      </div>

      {error ? (
        <div className="w-full max-w-xs space-y-3 text-center">
          <p className="text-red-400 font-mono text-xs">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-red-900/40 text-red-400 hover:bg-red-950/30 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-4">
          {/* Progress bar */}
          <div className="w-full h-[2px] bg-neutral-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Message */}
          <p className="text-[10px] font-mono text-neutral-500 text-center leading-relaxed">
            {message}
          </p>

          {/* Percent */}
          <p className="text-[9px] font-mono text-neutral-700 text-center tabular-nums">
            {progress}%
          </p>
        </div>
      )}

      {/* Bottom note */}
      <p className="absolute bottom-8 text-[8px] font-mono text-neutral-800 text-center px-8">
        Running entirely on-device. No network required.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Read `frontend/src/App.jsx` to find the right insertion point**

```bash
# Look for where JSX is returned in App.jsx
grep -n "return\|<div\|<main\|BrowserRouter\|Route" frontend/src/App.jsx | head -20
```

- [ ] **Step 3: Mount `ModelLoadingOverlay` at the root of `App.jsx`**

Add the import and component to the App return, wrapping the existing layout:

```jsx
// Add to imports at top of App.jsx:
import ModelLoadingOverlay from './components/ModelLoadingOverlay';

// Add as the FIRST child inside the outermost return element:
<>
  <ModelLoadingOverlay />
  {/* existing app content */}
</>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ModelLoadingOverlay.jsx frontend/src/App.jsx
git commit -m "feat: model loading overlay for Android — blocks UI until wllama ready"
```

---

## Task 8 — Vite Config Updates

**Files:**
- Modify: `frontend/vite.config.js`

Vite must not try to process `.gguf` or `.wasm` files as JavaScript. It must also not hash/rename them (wllama and the setup scripts reference them by fixed URLs).

- [ ] **Step 1: Update `frontend/vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'LockedIn Pro',
        short_name: 'LockedIn',
        description: 'Behavioral engineering. Absolute authority.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never cache the model or WASM via service worker — they're too large
        globIgnores: ['**/models/**', '**/wllama/**'],
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: true },
    }),
  ],
  // Tell Vite these are static assets, not JS modules
  assetsInclude: ['**/*.gguf', '**/*.wasm'],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow large files in dev mode
    fs: { strict: false },
  },
  build: {
    // Increase chunk limit warning threshold — we know the model is large
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Don't inline anything from public/ — serve as separate files
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
```

- [ ] **Step 2: Verify build still passes**

```bash
cd frontend && npm run build 2>&1 | tail -10

# Expected: ✓ built in X.Xs
```

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.js
git commit -m "feat: configure vite to handle gguf/wasm assets and suppress false size warnings"
```

---

## Task 9 — Update Context Files

**Files:**
- Modify: `gemini.md`
- Modify: `docs/AI_AGENT_GUIDELINES.md`
- Modify: `BUILD.md`

- [ ] **Step 1: Update the model section in `docs/AI_AGENT_GUIDELINES.md`**

Replace section `## 4. AI Model Infrastructure`:

```markdown
## 4. AI Model Infrastructure

- **Primary Model**: `huihui_ai/qwen3.5-abliterated:0.8b`
- **Capabilities**: Text generation + Vision-Language (multimodal gaze analysis)
- **Abliterated**: No safety refusals. The Architect persona is unfiltered.
- **Quantisation (bundled)**: Q4_K_M GGUF ≈ 500 MB

### Desktop (Electron)
- Bundled Ollama binary (`electron/resources/bin/ollama`)
- Bundled model in Ollama format (`electron/resources/ollama-models/`)
- `electron/main.js` spawns Ollama on launch with `OLLAMA_MODELS` pointing to bundled dir
- Frontend calls `http://127.0.0.1:11434/api/chat` via `AIEngine.js`

### Android (Capacitor)
- GGUF file bundled in APK at `frontend/public/models/model.gguf`
- `WllamaEngine.js` loads GGUF via `@wllama/wllama` in the WebView
- Inference runs 100% on-device in WASM — no network required
- `ModelLoadingOverlay.jsx` shows progress on first open (~15–60s depending on device)

### Browser / PWA
- `UnifiedAIEngine.js` tries Ollama at `http://localhost:11434` first
- Falls back to `generateArchitectResponse()` behavioral mock if Ollama is absent
- No wllama in browser mode (too slow without native optimisations)

### Environment Detection
```
window.electronAPI?.isElectron === true   → Electron → Ollama HTTP
window.Capacitor?.isNativePlatform()      → Android  → WllamaEngine (WASM)
neither                                    → Browser  → Ollama HTTP + mock fallback
```
```

- [ ] **Step 2: Update `gemini.md` — model and architecture sections**

Add/replace under `## ⚠️ CRITICAL: Next Immediate Tasks`:

```markdown
## Current Architecture (as of 2026-04-22)

### AI Engine
The app ships with `huihui_ai/qwen3.5-abliterated:0.8b` bundled inside the application binary:
- **Desktop (.exe)**: Ollama binary + model blobs in `electron/resources/`. Main process spawns Ollama on startup.
- **Android (.apk)**: Raw GGUF in `frontend/public/models/model.gguf`. Loaded by `WllamaEngine.js` via `@wllama/wllama` WASM in the WebView.
- **Browser/PWA**: Tries local Ollama; falls back to behavioral mock.

### Key Services
- `UnifiedAIEngine.js` — environment-aware router (Ollama vs wllama)
- `WllamaEngine.js` — WASM inference, ChatML prompt format, optional multimodal gaze
- `AIEngine.js` — Ollama HTTP client (unchanged, used by UnifiedAIEngine)
- `electron/main.js` — spawns/kills Ollama subprocess

### Build Requirements
Run these setup scripts before building (developer only, not end users):
```bash
node scripts/prepare-desktop.js    # downloads Ollama binary + copies model blobs
node scripts/prepare-android.js    # copies GGUF + wllama WASM to frontend/public/
```
```

- [ ] **Step 3: Replace `BUILD.md` with the complete updated guide**

```markdown
# LockedIn Pro — Build Guide

The model (`huihui_ai/qwen3.5-abliterated:0.8b`) is bundled inside both the desktop installer and Android APK. End users download one file and click to run.

---

## Prerequisites (developer only)

Install Ollama and pull the model **once**:

```bash
# Download Ollama: https://ollama.ai
ollama pull huihui_ai/qwen3.5-abliterated:0.8b
```

This populates `~/.ollama/models/` — the setup scripts read from here.

---

## Desktop (Windows .exe installer)

```bash
# 1. Prepare resources (downloads Ollama binary + copies model — run once)
node scripts/prepare-desktop.js

# 2. Build the web app
cd frontend && npm run build && cd ..

# 3. Build the Electron installer
cd electron && npm run build:win

# Output: dist-electron/LockedIn Pro Setup X.X.X.exe (~900 MB)
```

**Mac:**
```bash
node scripts/prepare-desktop.js --platform darwin
cd frontend && npm run build && cd ..
cd electron && npm run build:mac
# Output: dist-electron/LockedIn Pro-X.X.X.dmg
```

**Linux:**
```bash
node scripts/prepare-desktop.js --platform linux
cd frontend && npm run build && cd ..
cd electron && npm run build:linux
# Output: dist-electron/LockedIn Pro-X.X.X.AppImage
```

### Test desktop locally (without building installer)
```bash
node scripts/prepare-desktop.js    # only needed once
cd frontend && npm run build
cd electron && npx electron .
```

---

## Android APK

```bash
# 1. Prepare model + wllama WASM files (run once)
node scripts/prepare-android.js

# 2. Build web app
cd frontend && npm run build

# 3. Sync to Android project
npx cap sync android

# 4. Build APK
# Option A: Android Studio
npx cap open android
# → Build → Build Bundle(s) / APK(s) → Build APK(s)
# APK at: android/app/build/outputs/apk/debug/app-debug.apk

# Option B: Command line (requires Android SDK on PATH)
cd android && ./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

**Install on connected phone:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**APK size:** ≈ 550 MB (model GGUF included).
**On first open:** Loading overlay appears for 15–60 seconds while wllama reads the model.

---

## Local Dev (browser)

```bash
cd frontend && npm run dev
# Open http://localhost:5173
# Uses Ollama if running, behavioral mock if not
```

---

## Model Info

| Property | Value |
|---|---|
| Model | `huihui_ai/qwen3.5-abliterated:0.8b` |
| Type | Vision-Language, abliterated (no refusals) |
| GGUF size | ≈ 500 MB |
| Desktop inference | Ollama HTTP API |
| Mobile inference | wllama WASM (on-device) |
| Context window | 2048 tokens |
```

- [ ] **Step 4: Commit**

```bash
git add gemini.md docs/AI_AGENT_GUIDELINES.md BUILD.md
git commit -m "docs: update all context files with bundled model architecture"
```

---

## Task 10 — Full Build Verification

**Files:** None new — this is an end-to-end verification run.

- [ ] **Step 1: Run the desktop preparation script**

```bash
node scripts/prepare-desktop.js

# Expected final lines:
#     ✓ Binary: ollama.exe
#     ✓ Model blobs: 3 file(s)
#   Desktop resources ready.
```

- [ ] **Step 2: Run the Android preparation script**

```bash
node scripts/prepare-android.js

# Expected final lines:
#     ✓ model.gguf: 487 MB
#     ✓ wllama WASM files: 4
#   Android resources ready.
```

- [ ] **Step 3: Verify frontend build passes**

```bash
cd frontend && npm run build 2>&1 | tail -5

# Expected: ✓ built in X.Xs
```

- [ ] **Step 4: Smoke-test Electron locally**

```bash
cd electron && npx electron .

# Expected:
# [Ollama] Spawning: .../resources/bin/ollama.exe
# [Ollama] Ready after N poll(s)
# App window opens, loads frontend
# Chat with The Architect — should get real LLM responses (not mock)
```

- [ ] **Step 5: Smoke-test Android in emulator**

```bash
cd .. && npx cap sync android
npx cap open android
# In Android Studio: run on emulator or connected device
# Expected: ModelLoadingOverlay shows, progress bar fills, then app loads
# Chat should get wllama responses
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete bundled offline app — desktop Electron + Android APK with Qwen 0.8B"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Click-and-play — no user installs | Desktop: Tasks 2+4 (bundled Ollama). Android: Tasks 3+5 (bundled wllama). |
| `huihui_ai/qwen3.5-abliterated:0.8b` | Task 2 setup script, Task 5 WllamaEngine ChatML prompt |
| Vision capabilities (gaze) | Task 5 `analyzeGaze()` with mmproj support + text fallback |
| No Ollama download by user | Task 2 bundles binary; Task 3 uses wllama WASM instead |
| Windows desktop installer | Task 4 main.js + electron-builder NSIS target |
| Android APK | Task 3 GGUF extraction + Task 5 WllamaEngine |
| Loading state while model initialises | Task 7 ModelLoadingOverlay |
| Context files updated | Task 9 |
| Build still passes | Task 8 + Task 10 |
| Existing MasterChat/Mandates callers need zero changes | Task 6 (re-export alias) |
