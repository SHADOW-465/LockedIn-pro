#!/usr/bin/env node
/**
 * Run ONCE before building the Android APK:
 *   node scripts/prepare-android.js
 *
 * What it does:
 *   1. Extracts the raw GGUF model file from Ollama's cache →
 *      frontend/public/models/model.gguf  (Capacitor bundles this into the APK)
 *   2. Copies wllama WASM + worker JS files →
 *      frontend/public/wllama/single-thread/  (served by Capacitor WebView)
 *
 * Prerequisites:
 *   ollama pull huihui_ai/qwen3.5-abliterated:0.8b
 *   cd frontend && npm install @wllama/wllama
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MODEL_NAME  = 'huihui_ai/qwen3.5-abliterated';
const MODEL_TAG   = '0.8b';

const MODELS_DST  = path.join(ROOT, 'frontend', 'public', 'models');
const WLLAMA_SRC  = path.join(ROOT, 'frontend', 'node_modules', '@wllama', 'wllama', 'src');
const WLLAMA_DST  = path.join(ROOT, 'frontend', 'public', 'wllama');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function findOllamaModelsDir() {
  const candidates = [
    path.join(os.homedir(), '.ollama', 'models'),
    path.join(process.env.USERPROFILE || '', '.ollama', 'models'),
    path.join(process.env.APPDATA    || '', 'Ollama', 'models'),
    '/usr/share/ollama/.ollama/models',
  ];
  return candidates.find(d => d && fs.existsSync(d)) || null;
}

function copyFileWithProgress(src, dst) {
  const sizeMB = (fs.statSync(src).size / 1e6).toFixed(1);
  process.stdout.write(`  Copying (${sizeMB} MB)...`);
  fs.copyFileSync(src, dst);
  console.log(' done');
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function step1_extractGGUF() {
  console.log('\n[1/3] Extracting GGUF from Ollama cache...');

  const src = findOllamaModelsDir();
  if (!src) {
    console.error('Ollama models directory not found. Run: ollama pull ' + MODEL_NAME + ':' + MODEL_TAG);
    process.exit(1);
  }

  const manifestPath = path.join(
    src, 'manifests', 'registry.ollama.ai', MODEL_NAME, MODEL_TAG
  );
  if (!fs.existsSync(manifestPath)) {
    console.error('Model manifest not found at:\n  ' + manifestPath);
    console.error('Run: ollama pull ' + MODEL_NAME + ':' + MODEL_TAG);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // The main model weights layer
  const modelLayer = manifest.layers.find(l =>
    l.mediaType === 'application/vnd.ollama.image.model'
  );
  if (!modelLayer) {
    console.error('Could not find model layer in manifest. Layers found:');
    manifest.layers.forEach(l => console.error('  ', l.mediaType));
    process.exit(1);
  }

  ensureDir(MODELS_DST);

  const blobName = modelLayer.digest.replace(':', '-');
  const blobSrc  = path.join(src, 'blobs', blobName);
  const blobDst  = path.join(MODELS_DST, 'model.gguf');

  if (!fs.existsSync(blobSrc)) {
    console.error('Blob not found: ' + blobSrc);
    process.exit(1);
  }

  if (fs.existsSync(blobDst)) {
    const existingMB = (fs.statSync(blobDst).size / 1e6).toFixed(0);
    const srcMB      = (fs.statSync(blobSrc).size / 1e6).toFixed(0);
    if (existingMB === srcMB) {
      console.log(`  model.gguf already present (${existingMB} MB), skipping`);
    } else {
      console.log(`  Size mismatch — re-copying...`);
      copyFileWithProgress(blobSrc, blobDst);
    }
  } else {
    copyFileWithProgress(blobSrc, blobDst);
  }

  console.log('  ✓ model.gguf → frontend/public/models/model.gguf');

  // Vision projector (mmproj) — present only if the model is multimodal
  const mmprojLayer = manifest.layers.find(l =>
    l.mediaType === 'application/vnd.ollama.image.projector'
  );
  if (mmprojLayer) {
    const mmprojBlob = path.join(src, 'blobs', mmprojLayer.digest.replace(':', '-'));
    const mmprojDst  = path.join(MODELS_DST, 'mmproj.gguf');
    if (!fs.existsSync(mmprojDst)) {
      copyFileWithProgress(mmprojBlob, mmprojDst);
    } else {
      console.log('  mmproj.gguf already present, skipping');
    }
    console.log('  ✓ mmproj.gguf → frontend/public/models/mmproj.gguf (vision encoder)');
  } else {
    console.log('  Note: no vision projector found — gaze analysis will use text-only mode');
  }
}

function step2_copyWllamaWASM() {
  console.log('\n[2/3] Copying wllama WASM + worker files...');

  if (!fs.existsSync(WLLAMA_SRC)) {
    console.error('wllama not found at: ' + WLLAMA_SRC);
    console.error('Run: cd frontend && npm install @wllama/wllama');
    process.exit(1);
  }

  // Single-thread mode — required for Android WebView (no SharedArrayBuffer)
  const srcSingle = path.join(WLLAMA_SRC, 'single-thread');
  const dstSingle = path.join(WLLAMA_DST, 'single-thread');
  ensureDir(dstSingle);

  const stFiles = fs.readdirSync(srcSingle);
  for (const f of stFiles) {
    const srcF = path.join(srcSingle, f);
    const dstF = path.join(dstSingle, f);
    if (!fs.existsSync(dstF)) {
      fs.copyFileSync(srcF, dstF);
      console.log(`  Copied: single-thread/${f}`);
    } else {
      console.log(`  Exists: single-thread/${f}`);
    }
  }

  // Workers code (needed by wllama internals)
  const srcWorkers = path.join(WLLAMA_SRC, 'workers-code');
  if (fs.existsSync(srcWorkers)) {
    const dstWorkers = path.join(WLLAMA_DST, 'workers-code');
    ensureDir(dstWorkers);
    for (const f of fs.readdirSync(srcWorkers)) {
      const srcF = path.join(srcWorkers, f);
      const dstF = path.join(dstWorkers, f);
      if (!fs.existsSync(dstF)) fs.copyFileSync(srcF, dstF);
    }
  }

  console.log('  ✓ wllama files ready in frontend/public/wllama/');
}

function step3_verify() {
  console.log('\n[3/3] Verification...');

  const ggufPath = path.join(MODELS_DST, 'model.gguf');
  if (!fs.existsSync(ggufPath)) {
    throw new Error('model.gguf not found after copy');
  }
  const ggufMB = (fs.statSync(ggufPath).size / 1e6).toFixed(0);

  const wasmPath = path.join(WLLAMA_DST, 'single-thread', 'wllama.wasm');
  if (!fs.existsSync(wasmPath)) {
    throw new Error('wllama.wasm not found after copy');
  }

  console.log(`  ✓ model.gguf: ${ggufMB} MB`);
  console.log(`  ✓ wllama single-thread WASM: present`);
  console.log('\n  Android resources ready.');
  console.log('  Next:');
  console.log('    cd frontend && npm run build');
  console.log('    npx cap sync android');
  console.log('    npx cap open android   (then Build → Build APK)');
}

// ─── Run ──────────────────────────────────────────────────────────────────────

try {
  step1_extractGGUF();
  step2_copyWllamaWASM();
  step3_verify();
} catch (e) {
  console.error('\nFATAL:', e.message);
  process.exit(1);
}
