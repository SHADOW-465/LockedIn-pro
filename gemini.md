# LockedIn Pro - Development Hand-off & Context (gemini.md)

## Objective
LockedIn Pro is a local-first, highly opinionated behavioral engineering application designed for chastity and submission training. The central feature is "The Architect," an AI entity that has total autonomous control over the application's state (tiers, timers, mandates, punishments) based on the user's behavior.

## What Has Been Implemented So Far

### 1. App Gating & Onboarding ("The Intake")
*   **Status**: Fully functional. Complete lock-down of the app for first-time users.
*   **Mechanism**: A 23-question, terminal-style chat interview (`OnboardingChat.jsx`) must be completed.
*   **Result**: Automatically determines the user's starting tier (e.g., Toy, Servant, Object) and configures initial app settings based on psychological profiling from the chat.

### 2. The Architect AI Interface ("The Summons")
*   **Component**: `MasterChat.jsx`
*   **Function**: A persistent chat interface where the user interacts with the AI Master.
*   **Mechanics**: The AI receives user messages and can respond with standard text OR embed structural actions.

### 3. Autonomous State Enforcement Engine
*   **Components**: `ActionParser.js` and `AppControlAPI.js`
*   **How it Works**: The AI's response is scanned for action blocks (e.g., `[ACTION: {"type": "FORCE_GAZE"}]`). The `AppControlAPI` safely executes these commands, instantly mutating the local database (`dexie-react-hooks`).
*   **Capabilities**: The AI can autonomously `SET_TIER`, `ISSUE_PENANCE`, `EXTEND_LOCK_TIMER`, `FORCE_GAZE`, and `RESET_STREAK`.

### 4. Application UI & Layout
*   **Design System**: "Clinical Brutalism." Dark mode only, mono-spaced fonts (`index.css`), minimal spacing, premium thin dark scrollbars.
*   **Layouts**: `DesktopLayout.jsx` features a 5-item sidebar including a pulsing entry point to "The Summons". `MobileLayout.jsx` features a fixed bottom nav. TopAppBar is used for mobile headers, dynamically driven by the layout, stripped from individual pages to prevent double navs.
*   **Features**: Dashboard ("The Gaze" with Integrity Stats), Mandates list, Chronicle (Journal, Calendar, Inspection History).

### 5. "The Scroll" (Journey Export)
*   **Component**: `ScrollGenerator.js`
*   **Function**: Generates a self-contained, fully styled HTML document compiling the user's entire history (stats, journal entries, photos encoded as base64, AI comments, gaze records). Works offline, downloadable from the Chronicle page.

## Data Storage
*   **Local-First Database**: Uses `Dexie.js` (IndexedDB wrapping) for completely off-grid storage. No cloud servers are used for user data to preserve absolute privacy.
*   **State Management**: `AppDataContext` and local state handle real-time UI updates when the AI modifies state.

---

## ⚠️ CRITICAL: Next Immediate Tasks (High Priority)

The next AI agent taking over MUST address the following requested by the user:

### 1. Mandate / Task Verification Gap
*   **Issue**: Currently, when a user clicks complete on a mandate (task) in the UI, there is no verification mechanism. 
*   **Required Fix**: Implement a verification flow. The user must *prove* completion (e.g., file/photo upload, camera snap, written essay/journal entry) and The Architect must review it before the task is marked as truly "completed." Refusal, delays, or half-hearted attempts should trigger immediate AI punishment via `AppControlAPI`.

### 2. Architect Persona Overhaul (Psychological Deep-Dive)
*   **Issue**: The user reported the AI feels "very machine-like and AI like, not like a realistic dominant master."
*   **Required Fix**: Do extensive research on the psychology of natural dominant behavior (specifically authentic Femdom). Every word must carry the realism, weight, constraints, and psychological manipulation of a real Dominant who knows exactly what she's doing. The core design philosophy is to make the user "want to submit naturally" through psychological authority, not just robotic commands.
*   **Prompting/Engine Upgrade**: Revamp the system prompts (and potentially upgrade the local LLM logic in `AIEngine.js`) to handle deep emotional intelligence, sadism, authoritative conditioning, and clinical detachment.

## AI Model & Inference Architecture

**Model**: `huihui_ai/qwen3.5-abliterated:0.8b` (Qwen 3.5 VL 0.8B, abliterated — no safety filters)

**Inference routing** via `UnifiedAIEngine.js`:

| Environment | Engine | Location |
|-------------|--------|----------|
| Electron desktop | Ollama HTTP API (bundled binary) | `electron/resources/bin/ollama.exe` |
| Android APK | wllama WASM (`@wllama/wllama`) | `frontend/public/models/model.gguf` |
| Browser / PWA | Ollama HTTP API | User's local Ollama install |

`UnifiedAIEngine` auto-detects the environment at runtime and routes all AI calls transparently. Components import and use `UnifiedAIEngine` — they never call `AIEngine` or `WllamaEngine` directly.

## Bundled App Build

- **Desktop**: `node scripts/prepare-desktop.js` → downloads Ollama binary + copies model blobs → `cd electron && npm run build:win`
- **Android**: `node scripts/prepare-android.js` → copies GGUF + wllama WASM → `cd frontend && npm run build` → `npx cap sync android` → build APK in Android Studio

Both produce click-and-play binaries requiring zero additional downloads.

## Mandate Verification (Implemented)

- **Text mandates**: User writes a completion report inline. LLM evaluates it via `evaluateReport()`. Rejected submissions show the Architect's verdict and require rewrite.
- **Visual mandates**: `LiveCameraVerifier.jsx` opens a live getUserMedia stream with a 3-second countdown before frame capture. Anti-tamper: gallery selection is impossible.

## Existing Dev Commands
*   `npm run dev` to start the local vite server.
*   `npm run build` has been verified as building securely without errors.
