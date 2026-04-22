#!/usr/bin/env node
/**
 * Run ONCE before building the Electron installer:
 *   node scripts/prepare-desktop.js [--platform win32|darwin|linux]
 *
 * What it does:
 *   1. Downloads the Ollama binary for the target platform
 *   2. Copies the already-pulled model from ~/.ollama/models/ into electron/resources/
 *
 * Prerequisites:
 *   ollama pull huihui_ai/qwen3.5-abliterated:0.8b
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGET_PLATFORM = process.argv.includes('--platform')
  ? process.argv[process.argv.indexOf('--platform') + 1]
  : process.platform;

const RESOURCES_DIR = path.join(ROOT, 'electron', 'resources');
const BIN_DIR       = path.join(RESOURCES_DIR, 'bin');
const MODELS_DIR    = path.join(RESOURCES_DIR, 'ollama-models');

const MODEL_NAME = 'huihui_ai/qwen3.5-abliterated';
const MODEL_TAG  = '0.8b';

// Latest Ollama release download URLs per platform
const OLLAMA_URLS = {
  win32:  'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip',
  darwin: 'https://github.com/ollama/ollama/releases/latest/download/ollama-darwin',
  linux:  'https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const attempt = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return attempt(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} downloading ${u}`));
        }
        let downloaded = 0;
        const total = parseInt(res.headers['content-length'] || '0');
        res.on('data', chunk => {
          downloaded += chunk.length;
          if (total > 0) {
            process.stdout.write(`\r  ${(downloaded / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`);
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); console.log(); resolve(); });
      }).on('error', reject);
    };
    attempt(url);
  });
}

function findOllamaModelsDir() {
  const candidates = [
    path.join(os.homedir(), '.ollama', 'models'),
    path.join(process.env.USERPROFILE || '', '.ollama', 'models'),
    path.join(process.env.APPDATA    || '', 'Ollama', 'models'),
    '/usr/share/ollama/.ollama/models',
  ];
  return candidates.find(d => d && fs.existsSync(d)) || null;
}

// ─── Steps ────────────────────────────────────────────────────────────────────

async function step1_downloadOllamaBinary() {
  console.log(`\n[1/3] Downloading Ollama binary for ${TARGET_PLATFORM}...`);
  ensureDir(BIN_DIR);

  const url = OLLAMA_URLS[TARGET_PLATFORM];
  if (!url) throw new Error(`Unsupported platform: ${TARGET_PLATFORM}`);

  const binName = TARGET_PLATFORM === 'win32' ? 'ollama.exe' : 'ollama';
  const binDest = path.join(BIN_DIR, binName);

  if (fs.existsSync(binDest)) {
    console.log(`  Binary already present at ${binDest}, skipping download`);
    return;
  }

  if (TARGET_PLATFORM === 'win32') {
    const zipPath = path.join(BIN_DIR, 'ollama.zip');
    await downloadFile(url, zipPath);
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${BIN_DIR}' -Force"`,
      { stdio: 'inherit' }
    );
    fs.unlinkSync(zipPath);
    // Find and rename the exe if it came out with a different name
    const exes = fs.readdirSync(BIN_DIR).filter(f => f.toLowerCase().endsWith('.exe'));
    const mainExe = exes.find(f => f.toLowerCase().includes('ollama'));
    if (mainExe && mainExe !== 'ollama.exe') {
      fs.renameSync(path.join(BIN_DIR, mainExe), binDest);
    }
  } else {
    await downloadFile(url, binDest);
    fs.chmodSync(binDest, 0o755);
  }

  console.log(`  ✓ Binary saved to ${binDest}`);
}

function step2_copyModel() {
  console.log('\n[2/3] Copying model from local Ollama cache...');

  const src = findOllamaModelsDir();
  if (!src) {
    console.error([
      'ERROR: Ollama models directory not found.',
      'Make sure Ollama is installed and you have run:',
      `  ollama pull ${MODEL_NAME}:${MODEL_TAG}`,
    ].join('\n'));
    process.exit(1);
  }

  const manifestPath = path.join(
    src, 'manifests', 'registry.ollama.ai', MODEL_NAME, MODEL_TAG
  );

  if (!fs.existsSync(manifestPath)) {
    console.error([
      `ERROR: Manifest not found at: ${manifestPath}`,
      'Run: ollama pull ' + MODEL_NAME + ':' + MODEL_TAG,
    ].join('\n'));
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Copy the manifests directory for this model
  const dstManifestDir = path.join(
    MODELS_DIR, 'manifests', 'registry.ollama.ai', MODEL_NAME
  );
  ensureDir(dstManifestDir);
  fs.copyFileSync(manifestPath, path.join(dstManifestDir, MODEL_TAG));

  // Copy only blobs referenced by this manifest
  const blobsSrc = path.join(src, 'blobs');
  const blobsDst = path.join(MODELS_DIR, 'blobs');
  ensureDir(blobsDst);

  for (const layer of manifest.layers) {
    const blobName = layer.digest.replace(':', '-'); // sha256:XXX → sha256-XXX
    const srcBlob  = path.join(blobsSrc, blobName);
    const dstBlob  = path.join(blobsDst, blobName);

    if (!fs.existsSync(srcBlob)) {
      console.error(`  ERROR: Blob missing: ${blobName}`);
      process.exit(1);
    }
    if (fs.existsSync(dstBlob)) {
      console.log(`  Skipping blob ${blobName.slice(0, 26)}... (already copied)`);
    } else {
      const sizeMB = (fs.statSync(srcBlob).size / 1e6).toFixed(1);
      process.stdout.write(`  Copying ${blobName.slice(0, 26)}... (${sizeMB} MB)\n`);
      fs.copyFileSync(srcBlob, dstBlob);
    }
  }

  console.log('  ✓ Model blobs copied');
}

function step3_verify() {
  console.log('\n[3/3] Verifying resources...');
  const binName = TARGET_PLATFORM === 'win32' ? 'ollama.exe' : 'ollama';
  const binPath = path.join(BIN_DIR, binName);

  if (!fs.existsSync(binPath)) throw new Error('Ollama binary missing');

  const blobs = fs.readdirSync(path.join(MODELS_DIR, 'blobs'));
  if (blobs.length === 0) throw new Error('No model blobs found');

  const totalMB = blobs.reduce((acc, b) => {
    return acc + fs.statSync(path.join(MODELS_DIR, 'blobs', b)).size;
  }, 0) / 1e6;

  console.log(`  ✓ Binary: ${binName}`);
  console.log(`  ✓ Model blobs: ${blobs.length} file(s), ${totalMB.toFixed(0)} MB total`);
  console.log('\n  Desktop resources ready.');
  console.log('  Next: cd frontend && npm run build');
  console.log('        cd electron && npm install && npm run build:win');
}

// ─── Run ──────────────────────────────────────────────────────────────────────

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
