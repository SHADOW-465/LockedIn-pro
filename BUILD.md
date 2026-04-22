# LockedIn Pro — Build & Deploy Guide

---

## 1. Local Development (Browser)

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in Chrome/Edge. The app works fully in the browser with IndexedDB storage.

---

## 2. Desktop Installer (Electron — Bundled, Click-and-Play)

The desktop build includes the Ollama binary and the `huihui_ai/qwen3.5-abliterated:0.8b` model — no setup required for end users.

### Prerequisites (build machine only)
- Node.js 20+
- Ollama installed locally with the model pulled:
  ```bash
  ollama pull huihui_ai/qwen3.5-abliterated:0.8b
  ```

### Steps

```bash
# 1. Prepare resources (downloads Ollama binary + copies model from local cache)
node scripts/prepare-desktop.js

# 2. Build the frontend
cd frontend && npm run build && cd ..

# 3. Build the installer
cd electron && npm install && npm run build:win
# Output: dist-electron/LockedIn Pro Setup 1.0.0.exe
```

End users just run the installer — no Ollama download, no model download needed.

---

## 3. Android APK (Bundled GGUF, Click-and-Play)

The Android build embeds the GGUF model file inside the APK. Inference runs entirely on-device via wllama WASM (no server needed).

### Prerequisites (build machine only)
- Node.js 20+, Android Studio, Java 17+
- Ollama installed locally with the model pulled:
  ```bash
  ollama pull huihui_ai/qwen3.5-abliterated:0.8b
  ```
- wllama installed in frontend:
  ```bash
  cd frontend && npm install @wllama/wllama
  ```

### Steps

```bash
# 1. Prepare Android resources (copies GGUF + wllama WASM files)
node scripts/prepare-android.js

# 2. Build the frontend
cd frontend && npm run build

# 3. Sync to Android project
npx cap sync android

# 4. Build APK in Android Studio
npx cap open android
# Inside Android Studio: Build → Build APK(s)
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

> On first launch, a loading screen shows model initialization progress. Subsequent opens are instant (model stays warm in WebView).

---

## 4. Install as Desktop PWA (Chrome/Edge — Requires Ollama separately)

While running `npm run dev` or after `npm run build && npm run preview`:

1. Open `http://localhost:5173` in **Chrome** or **Edge**
2. Look for the **install icon** (⊕) in the address bar
3. Click **"Install LockedIn Pro"**

To use LLM features, run Ollama separately:
```bash
ollama pull huihui_ai/qwen3.5-abliterated:0.8b
ollama serve
```

---

## 5. Test on Mobile Without Building APK

While running `npm run dev`:

1. Phone and PC must be on the **same Wi-Fi network**
2. Find your PC's LAN IP (`ipconfig` on Windows)
3. Open `http://<PC-LAN-IP>:5173` in Chrome on your phone
4. Tap **"Add to Home Screen"**

> Camera access requires HTTPS on most mobile browsers for `192.168.x.x` addresses. Use the APK path for full camera access, or test features that don't require camera on LAN.

---

## 6. AI Model

All builds use **`huihui_ai/qwen3.5-abliterated:0.8b`** (Qwen 3.5 VL 0.8B, abliterated).

| Platform | Inference method | Model location |
|----------|-----------------|----------------|
| Desktop (Electron) | Bundled Ollama binary | `electron/resources/ollama-models/` |
| Android APK | wllama WASM (in-browser) | `frontend/public/models/model.gguf` |
| Browser / PWA | Ollama HTTP API | User's `~/.ollama/models/` |

The app auto-detects the environment and routes to the correct inference backend via `UnifiedAIEngine`.
