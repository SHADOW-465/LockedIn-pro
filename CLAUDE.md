# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Quick Start Commands

```bash
# Development
cd frontend && npm run dev              # Start Vite dev server (http://localhost:5173)
npm install --legacy-peer-deps          # Install dependencies (needed due to Capacitor peer deps)

# Building
npm run build                           # Vite production build (outputs to dist/)

# Linting
npm run lint                            # Run ESLint

# Preview
npm run preview                         # Preview production build locally
```

---

## Architecture Overview

**LockedIn Pro** is a behavioral engineering app for chastity/submission training. It's built as a **local-first, completely offline-capable** React app with a persistent IndexedDB database and a local LLM (Ollama or wllama WASM) that acts as "The Architect" — an autonomous AI dominant character.

### Core Design Pattern: Autonomous AI Dominance

The Architect does not passively respond to the user. Instead:
1. User completes a mandate (task/requirement)
2. `MandateFeedbackService` **fire-and-forget** triggers the AI to auto-generate a verdict
3. AI response is stored directly in `chat_messages` table
4. User's MasterChat component picks it up via `useLiveQuery` (no user action needed)
5. AI can embed `[ACTION: {...}]` tags in responses, which `AppControlAPI` executes autonomously

This creates the illusion of an always-watching, always-controlling dominant.

### Data Layer: Dexie IndexedDB

**File:** `frontend/src/services/db/db.js`

Single source of truth. All user data stored in IndexedDB (no cloud, pure privacy).

**Key tables:**
- `app_state` — key-value store (lockStartDate, targetLockDays, currentTier, etc.)
- `mandates` — tasks issued by the Architect
- `journal_entries` — user confessions
- `chat_messages` — conversation with The Architect (auto-populated by MandateFeedbackService)
- `punishments_log` — audit trail of sanctions and rewards
- `rag_documents` — user-uploaded training materials (chamber files)
- `gaze_sessions` — integrity inspection records
- `photos` — embedded images from journal/gaze

**Schema versioning:** Currently v2. When adding fields, increment version and include upgrade callback. See `difficulty` field addition in v2 for example.

**Live queries:** Use `dexie-react-hooks` `useLiveQuery` hook. Components automatically re-render when DB changes.

### AI Engine Abstraction: UnifiedAIEngine

**File:** `frontend/src/services/UnifiedAIEngine.js`

Routes AI calls to the correct backend at runtime:
- **Desktop (Electron):** Ollama HTTP API (bundled binary)
- **Android APK:** wllama WASM (in-browser inference)
- **Browser/PWA:** Ollama HTTP API (user's local install)

**Key methods:**
- `detectEnvironment()` — Auto-detects platform, caches result
- `isAvailable()` — Check if AI is ready
- `chat(systemPrompt, messages)` — LLM chat
- `evaluateReport(mandateTitle, report)` — Grade text mandate completion
- `analyzeGaze(imageBase64)` — Grade camera/gaze image

**Always call through UnifiedAIEngine, not AIEngine or WllamaEngine directly.** Never hard-code Ollama endpoints.

**Model:** `huihui_ai/qwen3.5-abliterated:0.8b` (Qwen 3.5 VL 0.8B, abliterated — no safety filters)

### State Management: AppDataContext

**File:** `frontend/src/contexts/AppDataContext.jsx`

Centralizes app-wide state and provides mutation methods. Uses live queries internally.

**Provides:**
- `mandates`, `journalEntries`, `gazeSessions` — live-queried arrays
- `stats` — computed dashboard metrics
- `completeMandate(id, completionData)` — Marks mandate done, triggers AI feedback
- `addMandate(mandateData)` — Creates new mandate
- `refreshStats()` — Recalculates integrity/streak/etc.

**Key pattern:** `completeMandate` is fire-and-forget. After calling `MandateService.complete()`, it immediately calls `MandateFeedbackService.trigger()` without await. The AI verdict appears async in MasterChat, creating the "always watching" feeling.

### AI Response Parsing: ActionParser + AppControlAPI

**Files:**
- `frontend/src/services/ai/ActionParser.js`
- `frontend/src/services/ai/AppControlAPI.js`

The Architect can embed **autonomous action tags** in responses:
```
[ACTION: {"type": "EXTEND_LOCK_TIMER", "days": 2}]
[ACTION: {"type": "ISSUE_PENANCE", "title": "...", "severity": "High"}]
[ACTION: {"type": "CREATE_MANDATE", "title": "...", "difficulty": 3}]
[ACTION: {"type": "REDUCE_LOCK_TIMER", "days": 1}]
```

`ActionParser.parseActions()` extracts these. `AppControlAPI` executes them safely:
- Mutates app state (timers, mandates)
- Logs to `punishments_log` for audit trail
- Calls hooks like `updateLevel()` if tier changed

**Valid action types:** See `ActionParser.VALID_TYPES` array for current list.

### System Prompt + RAG

**File:** `frontend/src/services/db/ChatService.js`

`buildSystemPrompt()` constructs the Architect's persona + context:
1. Reads chamber documents via `DocumentService.getTextContent()` — **RAG injection**
2. Includes mandate difficulty scale (1–5)
3. Lists available actions the AI can take
4. Sets tone: authoritative, psychological, sadistic but coherent

**Critical:** When modifying the system prompt, maintain the persona's consistency. Architect should feel like a real dominant character, not a chatbot.

---

## Key Components & Pages

### Core Pages

- **Home.jsx** — Dashboard with integrity score, stats pills, LockTimer, gaze inspection
- **MasterChat.jsx** — Chat interface with The Architect. AIStatusDot shows if Ollama is online.
- **Mandates.jsx** — Task list with completion modes (text essay, visual capture)
- **Chronicle.jsx** — Journal, calendar, inspection log, **Sanctions** tab (punishment/reward history), export
- **IndoctrinationChamber.jsx** — Chamber: upload training materials (documents, audio). Persisted via DocumentService.

### Key Components

- **LockTimer.jsx** — Live countdown timer. Reads `lockStartDate`, `targetLockDays`, `lockExtensionDays` from AppState. Updates every 1 second, refreshes every 30 seconds to pick up AI changes.
- **LiveCameraVerifier.jsx** — Camera capture modal for visual mandates. Takes instruction prop for specific guidance.
- **GazeInspection.jsx** — Integrity check: face-to-camera verification. Auto-grades via AI.

### Services

**Database services:**
- `MandateService.js` — CRUD for mandates
- `ChatService.js` — System prompt building, feedback prompt building
- `DocumentService.js` — Chamber file persistence (RAG)
- `PunishmentService.js` — Sanctions/rewards audit log
- `StatsService.js` — Compute integrity, streak, compliance %

**AI services:**
- `MandateFeedbackService.js` — Fire-and-forget auto-verdict after mandate completion
- `ActionParser.js` — Extract `[ACTION: {...}]` from AI responses
- `AppControlAPI.js` — Execute actions safely

**Other:**
- `BiometricService.js` — Face auth (chamber entry, gaze verification)
- `CameraService.js` — Camera access wrapper
- `ScrollGenerator.js` — Export full journey as self-contained HTML document

---

## Important Patterns & Conventions

### Live Queries Auto-Update UI

```javascript
const mandates = useLiveQuery(
  () => db.mandates.orderBy('createdAt').reverse().toArray(),
  [],
  []
);
// Component re-renders whenever a mandate is added/deleted/updated
```

When you mutate the DB (via a service), all components using that table's live query automatically re-render. No manual state sync needed.

### Fire-and-Forget AI Feedback

After user completes a mandate:
```javascript
// In completeMandate()
await MandateService.complete(id, completionData);
// Immediately trigger, don't wait
MandateFeedbackService.trigger(mandate, completionData, getControllers());
```

`MandateFeedbackService` runs async. It:
1. Calls AI to grade the completion
2. Writes response to `chat_messages` table
3. Executes any embedded ACTION tags
4. Catches all errors silently (fails gracefully if AI offline)

The user's MasterChat instantly displays the verdict because it watches `chat_messages` via `useLiveQuery`.

### Autonomous Action Execution

When the Architect says `[ACTION: {"type": "EXTEND_LOCK_TIMER", "days": 2}]`:
1. `ActionParser.parseActions()` extracts it
2. `AppControlAPI.handle()` executes it
3. State mutates, timers change, sanctions are logged
4. UI auto-updates via live queries

Never manually call actions. Always parse from AI response first.

### Schema Migrations

Dexie v2+ supports schema versioning:
```javascript
db.version(2).stores({
  mandates: '++id, ..., difficulty, ...'  // Added 'difficulty' index
}).upgrade(tx => {
  // Backfill: set difficulty=3 for existing mandates
  return tx.table('mandates').toCollection().modify(m => {
    if (m.difficulty === undefined) m.difficulty = 3;
  });
});
```

**Always keep version 1** — don't remove it. Dexie needs it for fresh installs.

---

## Testing & Build

- **No unit tests** currently. Future work would add Jest + React Testing Library.
- **Build warnings** about chunk size (>500 kB) are expected. The main bundle includes React + Tailwind + all pages + LLM inference logic. Not a blocker.
- **Dynamic imports** warning for `AIEngine.js` is informational only.

**Pre-flight checks before pushing:**
```bash
npm run build       # Must complete without errors
npm run lint        # Run linter; fix any rules violations
npm run dev         # Spot-check critical paths:
  # 1. Home → see LockTimer ticking
  # 2. Chamber → upload file → refresh page → file still there
  # 3. Mandates → visual mandate → AI status dot + instruction text
  # 4. Chronicle → "Sanctions" tab → shows empty state
  # 5. MasterChat → complete a text mandate → auto-verdict appears
```

---

## Recent Changes (Latest Session)

**13-task feature plan completed (2026-04-22):**
1. Live lock timer with add/remove time, visible on Home
2. AI can manipulate timers (EXTEND_LOCK_TIMER, REDUCE_LOCK_TIMER)
3. Visual verification: AI checks availability, gives specific instructions, grades captures
4. AI creates mandates (CREATE_MANDATE action)
5. Auto-feedback: MandateFeedbackService fires after completion
6. RAG pipeline: chamber documents injected into system prompt
7. Escalating task difficulty: 1–5 scale, AI-driven creation
8. Punishment/reward log: Sanctions tab in Chronicle
9. Chamber storage: persists via DocumentService + useLiveQuery
10. AI model fixed: correct model loaded, personality improved

See `docs/superpowers/plans/2026-04-22-problems-fixes.md` for full breakdown and commit history.

---

## Developer Notes

- **Offline-first mindset:** All features must work without internet. Ollama runs locally (bundled on desktop/Android, user-installed on browser).
- **Platform abstraction:** Don't assume Electron or browser. Use `UnifiedAIEngine` and `PlatformContext` to detect environment.
- **Performance:** IndexedDB is fast. Use live queries liberally. Large file uploads (images, PDFs) can be slow — consider compression.
- **Privacy:** No user data leaves the device. No analytics, no cloud. Builds are self-contained.
- **Persona consistency:** The Architect is a character. System prompts should feel psychologically grounded, not robotic. Read existing prompts in `ChatService.buildSystemPrompt()` for tone.
- **Action safety:** `AppControlAPI` validates action types before executing. Always add new actions to `ActionParser.VALID_TYPES` first.

---

## Useful File Locations

```
frontend/
  src/
    pages/           # Top-level views (Home, Mandates, Chronicle, MasterChat, Chamber)
    components/      # Reusable UI (LockTimer, LiveCameraVerifier, etc.)
    services/
      db/            # Dexie tables, CRUD services, StatsService
      ai/            # ActionParser, AppControlAPI, MandateFeedbackService
      export/        # ScrollGenerator (HTML export)
    contexts/        # AppDataContext, HierarchyContext, PlatformContext
    index.css        # Tailwind config, design tokens (Clinical Brutalism aesthetic)
  public/            # PWA icons, manifest
  vite.config.js     # Vite + PWA setup
electron/            # Electron desktop build (optional)
android/             # Capacitor Android project (optional)
docs/superpowers/plans/   # Implementation plans (reference for context)
```

---

## Troubleshooting

**"AI is offline" but Ollama is running:**
- Check `http://localhost:11434/api/tags` — returns model list
- Verify model is pulled: `ollama pull huihui_ai/qwen3.5-abliterated:0.8b`
- Check that the model prefix matches in `AIEngine.DEFAULT_MODEL`

**Chamber files disappearing on refresh:**
- Ensure `DocumentService.getAll()` is being called via `useLiveQuery`
- Verify `DocumentService.add()` was called with correct parameters
- Check IndexedDB in DevTools (Application → IndexedDB → LockedInProDB → rag_documents)

**Mandates not completing:**
- Check browser console for errors in `MandateFeedbackService` (wrapped in try/catch)
- Verify mandate has a `status` field and is queried correctly
- Check that `completeMandate()` is actually called (may be blocked by UI state)

**LockTimer not updating:**
- Verify `lockStartDate` and `targetLockDays` are set in `app_state`
- Check that LockTimer component mounted (it refreshes every 30s to sync with DB)
- AI actions that modify timers should update `lockExtensionDays` in AppState

