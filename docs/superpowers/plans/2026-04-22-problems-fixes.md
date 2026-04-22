# LockedIn Pro — Problems Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 reported issues: live lock timer, persistent chamber storage, functional RAG pipeline, AI model health verification, auto-mandate feedback, visual verification with AI grading, escalating tasks, and a punishments/rewards log page.

**Architecture:** Dexie IndexedDB is the single source of truth — all state that vanishes (chamber files, punishment history) must be persisted there. The AI pipeline routes through `UnifiedAIEngine` which abstracts Ollama (desktop) vs wllama WASM (Android). A new `MandateFeedbackService` triggers automatic post-completion AI responses injected directly into the chat `chat_messages` table, which MasterChat picks up via its existing `useLiveQuery` hook.

**Tech Stack:** React 19, Dexie 4 (IndexedDB), Ollama HTTP API, `@wllama/wllama` v2, Capacitor 8, Vite 8

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Modify** | `frontend/src/services/db/db.js` | Schema v2 — add `difficulty` index to mandates |
| **Create** | `frontend/src/services/db/DocumentService.js` | CRUD for `rag_documents` table |
| **Create** | `frontend/src/services/db/PunishmentService.js` | CRUD for `punishments_log` table |
| **Create** | `frontend/src/components/LockTimer.jsx` | Live countdown/elapsed timer, reads AppState |
| **Create** | `frontend/src/services/ai/MandateFeedbackService.js` | Triggers AI verdict into chat after mandate completion |
| **Modify** | `frontend/src/pages/IndoctrinationChamber.jsx` | Replace React state with DocumentService + useLiveQuery |
| **Modify** | `frontend/src/services/AIEngine.js` | Fix default model, add `isModelLoaded()` |
| **Modify** | `frontend/src/services/ai/ActionParser.js` | Add `REDUCE_LOCK_TIMER`, `CREATE_MANDATE` to valid types |
| **Modify** | `frontend/src/services/ai/AppControlAPI.js` | Handle new actions, log punishments/rewards |
| **Modify** | `frontend/src/services/db/ChatService.js` | RAG injection, expanded system prompt, `buildMandateFeedbackPrompt()` |
| **Modify** | `frontend/src/contexts/AppDataContext.jsx` | Call MandateFeedbackService after completeMandate |
| **Modify** | `frontend/src/pages/Home.jsx` | Replace static `daysLocked` pill with `LockTimer` |
| **Modify** | `frontend/src/pages/MasterChat.jsx` | AI status indicator, better placeholder text |
| **Modify** | `frontend/src/pages/Mandates.jsx` | Visual: check AI availability, show instructions, grade capture |
| **Modify** | `frontend/src/components/LiveCameraVerifier.jsx` | Add `instruction` prop display |
| **Modify** | `frontend/src/pages/Chronicle.jsx` | Add "Sanctions" tab backed by PunishmentService |

---

## Task 1: DB Schema v2 — Add `difficulty` to Mandates

**Files:**
- Modify: `frontend/src/services/db/db.js`

- [ ] **Step 1: Add version 2 schema to db.js**

Replace the entire file:

```javascript
import Dexie from 'dexie';

export const db = new Dexie('LockedInProDB');

db.version(1).stores({
  app_state: 'key',
  mandates: '++id, title, status, category, importance, createdAt, completedAt, dueDate, issuedByMaster',
  journal_entries: '++id, text, mood, createdAt, aiComment, hasPhotos',
  photos: '++id, journalEntryId, gazeSessionId, dataUrl, type, createdAt',
  gaze_sessions: '++id, result, aiComment, imageDataUrl, createdAt, tierAtTime',
  chat_messages: '++id, role, content, actions, createdAt',
  punishments_log: '++id, reason, type, severity, issuedAt, resolvedAt, resolved',
  rag_documents: '++id, name, type, content, status, uploadedAt',
});

// v2: adds difficulty index to mandates (enables AI-escalated task queries)
db.version(2).stores({
  mandates: '++id, title, status, category, importance, difficulty, createdAt, completedAt, dueDate, issuedByMaster',
}).upgrade(tx => {
  // Backfill existing mandates with difficulty=3 (medium)
  return tx.table('mandates').toCollection().modify(m => {
    if (m.difficulty === undefined) m.difficulty = 3;
  });
});

// Key-value store helpers for app_state
export const AppState = {
  async get(key) {
    const row = await db.app_state.get(key);
    return row ? row.value : null;
  },
  async set(key, value) {
    await db.app_state.put({ key, value });
  },
  async getAll() {
    const rows = await db.app_state.toArray();
    return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  }
};

export default db;
```

- [ ] **Step 2: Verify Dexie opens without errors**

Run: `cd frontend && npm run dev`
Expected: No console errors about DB version conflict. Visit `http://localhost:5173`, open DevTools → Application → IndexedDB — `mandates` table should have `difficulty` in its indexes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/db/db.js
git commit -m "feat(db): schema v2 — add difficulty index to mandates"
```

---

## Task 2: DocumentService — Chamber File Persistence

**Files:**
- Create: `frontend/src/services/db/DocumentService.js`

- [ ] **Step 1: Create DocumentService.js**

```javascript
import db from './db';

export const DocumentService = {
  async getAll() {
    return db.rag_documents.orderBy('uploadedAt').reverse().toArray();
  },

  /**
   * Add a document. For text files, pass the extracted text in `content`.
   * For audio/binary, content should be '' (only metadata stored).
   */
  async add({ name, type, content = '', status = 'Synced' }) {
    return db.rag_documents.add({
      name,
      type,
      content,
      status,
      uploadedAt: new Date().toISOString(),
    });
  },

  async updateStatus(id, status) {
    return db.rag_documents.update(id, { status });
  },

  async delete(id) {
    return db.rag_documents.delete(id);
  },

  /**
   * Returns a single concatenated string of all text document contents.
   * Used by ChatService to inject chamber knowledge into the AI system prompt.
   */
  async getTextContent() {
    const docs = await db.rag_documents
      .where('type').equals('Transcript')
      .toArray();
    if (docs.length === 0) return '';
    return docs
      .map(d => `[Document: ${d.name}]\n${d.content}`)
      .join('\n\n---\n\n');
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/db/DocumentService.js
git commit -m "feat(db): DocumentService for rag_documents persistence"
```

---

## Task 3: PunishmentService — Punishment Log Persistence

**Files:**
- Create: `frontend/src/services/db/PunishmentService.js`

- [ ] **Step 1: Create PunishmentService.js**

```javascript
import db from './db';

/**
 * PunishmentService — writes to the `punishments_log` table.
 * Called by AppControlAPI whenever the Architect issues a punishment or reward.
 * type: 'punishment' | 'reward'
 * severity: 'High' | 'Medium' | 'Low'
 */
export const PunishmentService = {
  async log({ reason, type = 'punishment', severity = 'Medium', aiComment = '' }) {
    return db.punishments_log.add({
      reason,
      type,
      severity,
      aiComment,
      issuedAt: new Date().toISOString(),
      resolvedAt: null,
      resolved: false,
    });
  },

  async getAll() {
    return db.punishments_log.orderBy('issuedAt').reverse().toArray();
  },

  async resolve(id) {
    return db.punishments_log.update(id, {
      resolved: true,
      resolvedAt: new Date().toISOString(),
    });
  },

  async getRecent(limit = 20) {
    return db.punishments_log
      .orderBy('issuedAt')
      .reverse()
      .limit(limit)
      .toArray();
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/db/PunishmentService.js
git commit -m "feat(db): PunishmentService for punishments_log table"
```

---

## Task 4: Fix IndoctrinationChamber Persistence

**Files:**
- Modify: `frontend/src/pages/IndoctrinationChamber.jsx`

The chamber currently uses React `useState` only — files vanish on navigate. Fix: use `useLiveQuery` on `rag_documents` and write to DB on upload.

- [ ] **Step 1: Rewrite IndoctrinationChamber.jsx**

```jsx
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { SummaryCard, StatCard, VaultFileCard } from '../components/BentoCards';
import { BiometricService } from '../services/BiometricService';
import { DocumentService } from '../services/db/DocumentService';

export default function IndoctrinationChamber() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Live query — auto-updates when any document is added/deleted
  const files = useLiveQuery(
    () => DocumentService.getAll(),
    [],
    []
  );

  const handleAuth = async () => {
    const success = await BiometricService.authenticate("Face the Architect's Gaze to proceed.");
    setIsAuthenticated(success);
  };

  // Authenticate on mount
  React.useEffect(() => { handleAuth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || uploading) return;
    e.target.value = '';
    setUploading(true);

    const isAudio = /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
    const isText = /\.(txt|md|pdf|doc|docx)$/i.test(file.name);
    const type = isAudio ? 'Audio' : 'Transcript';

    // For text files: read content for RAG. For audio: store metadata only.
    let content = '';
    if (isText) {
      try {
        content = await file.text();
      } catch {
        content = '';
      }
    }

    await DocumentService.add({ name: file.name, type, content, status: 'Synced' });
    setUploading(false);
  };

  const deleteFile = async (id) => {
    await DocumentService.delete(id);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 bg-stripes-dark animate-in fade-in zoom-in-95 duration-500">
        <span className="material-symbols-outlined text-[80px] text-primary mb-6 animate-pulse drop-shadow-[0_0_15px_rgba(255,0,85,0.5)]">fingerprint</span>
        <h2 className="text-3xl font-display font-bold mb-3 tracking-tighter uppercase text-center">Chamber Locked</h2>
        <p className="text-on-surface-variant font-mono text-xs text-center max-w-sm mb-10 leading-relaxed">
          Access to the Indoctrination Chamber requires biometric submission. The Architect demands to see you.
        </p>
        <button
          onClick={handleAuth}
          className="px-8 py-4 bg-primary text-on-primary rounded-pill font-bold tracking-widest text-sm hover:opacity-90 transition-all hover:shadow-[0_0_20px_rgba(255,0,85,0.6)] active:scale-95"
        >
          SUBMIT FOR VERIFICATION
        </button>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface">
      <main className="px-5 py-6 max-w-2xl mx-auto space-y-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-8">
            <SummaryCard
              title="Architect's Memory"
              value={`${files.length} Document${files.length !== 1 ? 's' : ''} Ingested`}
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <StatCard title="Chamber Files" value={files.length} trend="Persisted" />
          </div>
        </div>

        <section className="relative group">
          <input
            type="file"
            accept=".txt,.md,.pdf,.doc,.docx,.mp3,.wav,.ogg,.m4a"
            onChange={handleFileUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
          />
          <div className={`bg-surface-container border-2 border-dashed rounded-[40px] p-10 flex flex-col items-center justify-center text-center transition-all ${uploading ? 'border-primary/60 bg-primary/5' : 'border-outline/20 group-hover:border-primary/40 group-hover:bg-primary/5'}`}>
            <span className="material-symbols-outlined text-4xl mb-4 text-on-surface-variant group-hover:text-primary transition-colors">
              {uploading ? 'hourglass_top' : 'cloud_upload'}
            </span>
            <h3 className="font-display font-bold text-lg">
              {uploading ? 'Ingesting...' : 'Ingest New Training'}
            </h3>
            <p className="text-on-surface-variant text-sm mt-1">
              Upload text documents (.txt, .md) or audio affirmations (.mp3, .wav). Text files are indexed for the Architect's memory.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-display font-bold tracking-tight px-2">The Library</h2>
          {files.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant font-mono text-xs">
              The chamber is empty. Upload training materials to shape the Architect's understanding.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {files.map(file => (
                <VaultFileCard
                  key={file.id}
                  {...file}
                  date={new Date(file.uploadedAt).toISOString().split('T')[0]}
                  onDelete={() => deleteFile(file.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify persistence works**

Run dev server. Upload a text file in Chamber. Navigate to Home, come back. File should still be there.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/IndoctrinationChamber.jsx
git commit -m "fix(chamber): persist documents to rag_documents via DocumentService"
```

---

## Task 5: LockTimer Component

**Files:**
- Create: `frontend/src/components/LockTimer.jsx`

Shows live elapsed time since lock start + countdown to target end. Updates every second. No external deps beyond AppState.

- [ ] **Step 1: Create LockTimer.jsx**

```jsx
import React, { useState, useEffect } from 'react';
import { AppState } from '../services/db/db';

function pad(n) { return String(n).padStart(2, '0'); }

function msToComponents(ms) {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const total = Math.floor(ms / 1000);
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

function TimeDisplay({ label, components, urgent = false }) {
  const { d, h, m, s } = components;
  return (
    <div>
      <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <div className={`font-mono text-2xl font-bold tabular-nums ${urgent ? 'text-primary animate-pulse' : 'text-neutral-100'}`}>
        {d > 0 ? `${d}d ` : ''}{pad(h)}:{pad(m)}:{pad(s)}
      </div>
    </div>
  );
}

/**
 * LockTimer — reads lockStartDate, targetLockDays, lockExtensionDays from AppState.
 * Ticks every second. Shows elapsed + remaining (if target set).
 * onSetDuration — called when user sets initial duration (only shown when no target yet).
 */
export default function LockTimer({ onSetDuration }) {
  const [lockStart, setLockStart] = useState(null);
  const [targetDays, setTargetDays] = useState(null);
  const [extensionDays, setExtensionDays] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [settingDuration, setSettingDuration] = useState(false);
  const [draftDays, setDraftDays] = useState('');

  useEffect(() => {
    async function load() {
      const [start, target, ext] = await Promise.all([
        AppState.get('lockStartDate'),
        AppState.get('targetLockDays'),
        AppState.get('lockExtensionDays'),
      ]);
      setLockStart(start || null);
      setTargetDays(target ? Number(target) : null);
      setExtensionDays(ext ? Number(ext) : 0);
      setLoading(false);
    }
    load();
  }, []);

  // Re-read AppState every 30s to pick up changes made by AI actions
  useEffect(() => {
    const refresh = setInterval(async () => {
      const [target, ext] = await Promise.all([
        AppState.get('targetLockDays'),
        AppState.get('lockExtensionDays'),
      ]);
      setTargetDays(target ? Number(target) : null);
      setExtensionDays(ext ? Number(ext) : 0);
    }, 30000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleSetDuration = async () => {
    const days = parseInt(draftDays, 10);
    if (!days || days < 1) return;
    await AppState.set('targetLockDays', days);
    if (!lockStart) {
      const startDate = new Date().toISOString();
      await AppState.set('lockStartDate', startDate);
      setLockStart(startDate);
    }
    setTargetDays(days);
    setSettingDuration(false);
    setDraftDays('');
    onSetDuration?.();
  };

  if (loading) return null;

  if (!lockStart) {
    return (
      <div className="bg-surface-container rounded-3xl p-6 border border-outline/10 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-on-surface-variant">Lock Session</p>
        <p className="text-neutral-500 font-mono text-xs">No active lock. The Architect may initialize one, or set a target below.</p>
        <button
          onClick={() => setSettingDuration(true)}
          className="text-[10px] font-mono uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
        >
          + Set duration
        </button>
        {settingDuration && (
          <div className="flex gap-2 items-center pt-2">
            <input
              type="number"
              min="1"
              max="365"
              value={draftDays}
              onChange={e => setDraftDays(e.target.value)}
              placeholder="Days"
              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-mono text-neutral-200 outline-none focus:border-primary/50"
            />
            <button
              onClick={handleSetDuration}
              className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors"
            >
              Lock
            </button>
            <button
              onClick={() => setSettingDuration(false)}
              className="text-[10px] text-neutral-600 font-mono hover:text-neutral-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  const startMs = new Date(lockStart).getTime();
  const elapsedMs = now - startMs;
  const elapsed = msToComponents(elapsedMs);

  let remaining = null;
  let totalTargetDays = null;
  let isUrgent = false;
  if (targetDays !== null) {
    totalTargetDays = Math.max(0, targetDays + extensionDays);
    const totalTargetMs = totalTargetDays * 86400 * 1000;
    const remainingMs = totalTargetMs - elapsedMs;
    remaining = msToComponents(Math.max(0, remainingMs));
    isUrgent = remainingMs > 0 && remainingMs < 3600 * 1000; // < 1 hour
  }

  return (
    <div className="bg-surface-container rounded-3xl p-6 border border-outline/10 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-on-surface-variant">Lock Session</p>
        <div className="flex items-center gap-2">
          {extensionDays > 0 && (
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-900/40">
              +{extensionDays}d added
            </span>
          )}
          {extensionDays < 0 && (
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-900/40">
              {extensionDays}d removed
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TimeDisplay label="Elapsed" components={elapsed} />
        {remaining !== null && (
          <TimeDisplay label="Remaining" components={remaining} urgent={isUrgent} />
        )}
      </div>

      {totalTargetDays !== null && (
        <div className="space-y-1">
          <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${Math.min(100, (elapsedMs / (totalTargetDays * 86400 * 1000)) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] font-mono text-neutral-600">
            Target: {totalTargetDays} day{totalTargetDays !== 1 ? 's' : ''}
            {extensionDays !== 0 ? ` (base ${targetDays}d ${extensionDays > 0 ? '+' : ''}${extensionDays}d)` : ''}
          </p>
        </div>
      )}

      {targetDays === null && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingDuration(true)}
            className="text-[10px] font-mono uppercase tracking-widest text-primary/50 hover:text-primary/80 transition-colors"
          >
            + Set target duration
          </button>
          {settingDuration && (
            <>
              <input
                type="number"
                min="1"
                max="365"
                value={draftDays}
                onChange={e => setDraftDays(e.target.value)}
                placeholder="Days"
                className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm font-mono text-neutral-200 outline-none focus:border-primary/50"
              />
              <button
                onClick={handleSetDuration}
                className="px-2 py-1 rounded-lg bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors"
              >
                Set
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/LockTimer.jsx
git commit -m "feat: LockTimer component with live countdown and extension display"
```

---

## Task 6: New AI Action Types + Punishment Logging

**Files:**
- Modify: `frontend/src/services/ai/ActionParser.js`
- Modify: `frontend/src/services/ai/AppControlAPI.js`

- [ ] **Step 1: Update ActionParser.js — add REDUCE_LOCK_TIMER and CREATE_MANDATE**

```javascript
/**
 * ActionParser — extracts and validates [ACTION:{...}] payloads from AI responses.
 */
export class ActionParser {
  static ACTION_REGEX = /\[ACTION:(\{[^}]+\})\]/g;

  static parse(responseText) {
    const actions = [];
    let match;
    const regex = new RegExp(this.ACTION_REGEX.source, 'g');

    while ((match = regex.exec(responseText)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (this.validate(parsed)) {
          actions.push(parsed);
        }
      } catch (e) {
        console.warn('[ActionParser] Malformed action payload skipped:', match[1]);
      }
    }
    return actions;
  }

  static stripActions(responseText) {
    return responseText.replace(this.ACTION_REGEX, '').trim();
  }

  static validate(action) {
    const VALID_TYPES = [
      'SET_TIER', 'ISSUE_PENANCE', 'EXTEND_LOCK_TIMER', 'REDUCE_LOCK_TIMER',
      'CREATE_MANDATE', 'FORCE_GAZE', 'INCREASE_NOTIFICATION_FREQ',
      'RESET_STREAK', 'SET_TRAINING_FOCUS', 'SET_NOTIFICATION_SCHEDULE',
      'SET_INITIAL_LOCK_DURATION', 'LOCK_APP_SECTION', 'INJECT_AFFIRMATION'
    ];
    return action && typeof action.type === 'string' && VALID_TYPES.includes(action.type);
  }
}
```

- [ ] **Step 2: Update AppControlAPI.js — add handlers and punishment logging**

```javascript
import { AppState } from '../db/db';
import { MandateService } from '../db/MandateService';
import { PunishmentService } from '../db/PunishmentService';
import { NotificationService } from '../NotificationService';
import { POSSESSION_LEVELS } from '../../contexts/HierarchyContext';

/**
 * AppControlAPI — the Architect's enforcement arm.
 * Receives validated action objects and mutates application state.
 */
export class AppControlAPI {
  static async dispatch(action, { updateLevel, setAppState, refreshStats }) {
    console.log(`[AppControlAPI] Executing: ${action.type}`, action);

    switch (action.type) {
      case 'SET_TIER': {
        const newLevel = Object.values(POSSESSION_LEVELS).find(
          l => l.id === action.value || l.name.toLowerCase() === action.value?.toLowerCase()
        );
        if (newLevel) {
          updateLevel(newLevel.id);
          await AppState.set('possessionLevel', newLevel);
          await NotificationService.requestPermissions();
          await NotificationService.scheduleSpontaneousSpasm(newLevel.id);
          return `⚡ LEVEL UPGRADED TO [${newLevel.name.toUpperCase()}]`;
        }
        return null;
      }

      case 'ISSUE_PENANCE': {
        await MandateService.issuePenance({
          title: action.title || 'Complete a penance task as directed by the Architect.',
          severity: action.severity || 'High',
        });
        await PunishmentService.log({
          reason: action.title || 'Penance issued by Architect',
          type: 'punishment',
          severity: action.severity || 'High',
          aiComment: action.comment || '',
        });
        refreshStats();
        return `⚡ PENANCE ISSUED: "${action.title}"`;
      }

      case 'EXTEND_LOCK_TIMER': {
        const currentDays = Number(await AppState.get('lockExtensionDays')) || 0;
        const daysToAdd = action.days || 1;
        await AppState.set('lockExtensionDays', currentDays + daysToAdd);
        await PunishmentService.log({
          reason: `Lock extended ${daysToAdd} day(s) — ${action.reason || 'punishment'}`,
          type: 'punishment',
          severity: 'High',
          aiComment: action.comment || '',
        });
        refreshStats();
        return `🔒 LOCK EXTENDED BY ${daysToAdd} DAY(S)`;
      }

      case 'REDUCE_LOCK_TIMER': {
        const currentExt = Number(await AppState.get('lockExtensionDays')) || 0;
        const currentTarget = Number(await AppState.get('targetLockDays')) || 0;
        const daysToRemove = action.days || 1;
        // Clamp: total lock time cannot go below 0
        const newExt = Math.max(-currentTarget, currentExt - daysToRemove);
        await AppState.set('lockExtensionDays', newExt);
        await PunishmentService.log({
          reason: `Lock reduced ${daysToRemove} day(s) — ${action.reason || 'reward'}`,
          type: 'reward',
          severity: 'Medium',
          aiComment: action.comment || '',
        });
        refreshStats();
        return `🔓 LOCK REDUCED BY ${daysToRemove} DAY(S) — EARNED`;
      }

      case 'CREATE_MANDATE': {
        await MandateService.add({
          title: action.title || 'Complete the assigned task.',
          category: action.category || 'Mandate',
          importance: action.importance || 'Medium',
          dueDate: action.dueDate || null,
          issuedByMaster: true,
          difficulty: action.difficulty || 3,
        });
        refreshStats();
        return `📋 MANDATE ISSUED: "${action.title}"`;
      }

      case 'RESET_STREAK': {
        await AppState.set('streakResetAt', new Date().toISOString());
        await PunishmentService.log({
          reason: 'Compliance streak reset by Architect',
          type: 'punishment',
          severity: 'High',
          aiComment: action.comment || '',
        });
        refreshStats();
        return `❌ COMPLIANCE STREAK RESET TO ZERO`;
      }

      case 'FORCE_GAZE': {
        await AppState.set('forceGaze', 'true');
        return `👁 IMMEDIATE INSPECTION DEMANDED`;
      }

      case 'INCREASE_NOTIFICATION_FREQ': {
        const multiplier = action.multiplier || 2;
        await AppState.set('notificationMultiplier', multiplier);
        return `📡 INSPECTION FREQUENCY INCREASED ×${multiplier}`;
      }

      case 'INJECT_AFFIRMATION': {
        const text = action.text || 'I am grateful for my lock and my Master.';
        await MandateService.add({
          title: `Affirmation: "${text}"`,
          category: 'Affirmation',
          importance: 'High',
          issuedByMaster: true,
          difficulty: 1,
        });
        refreshStats();
        return `📜 AFFIRMATION INJECTED INTO MANDATES`;
      }

      case 'SET_TRAINING_FOCUS': {
        await AppState.set('trainingFocus', action.focus || action.value);
        return `🎯 TRAINING FOCUS UPDATED: ${action.focus || action.value}`;
      }

      case 'SET_INITIAL_LOCK_DURATION': {
        if (!await AppState.get('lockStartDate')) {
          await AppState.set('lockStartDate', new Date().toISOString());
        }
        await AppState.set('targetLockDays', action.days || 7);
        await AppState.set('lockExtensionDays', 0);
        return `🔒 LOCK TIMER INITIALIZED: ${action.days || 7} DAYS TARGET`;
      }

      case 'SET_NOTIFICATION_SCHEDULE': {
        await AppState.set('quietHoursStart', action.quietStart || null);
        await AppState.set('quietHoursEnd', action.quietEnd || null);
        return `📡 NOTIFICATION SCHEDULE SET`;
      }

      default:
        return null;
    }
  }

  static async dispatchAll(actions, controllers) {
    const logs = [];
    for (const action of actions) {
      const log = await this.dispatch(action, controllers);
      if (log) logs.push(log);
    }
    return logs;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/ai/ActionParser.js frontend/src/services/ai/AppControlAPI.js
git commit -m "feat(ai): add REDUCE_LOCK_TIMER, CREATE_MANDATE actions; log punishments/rewards"
```

---

## Task 7: AI Engine — Correct Defaults and Model Health Check

**Files:**
- Modify: `frontend/src/services/AIEngine.js`

The current default model is `llama3.2` — wrong. The bundled model is `huihui_ai/qwen3.5-abliterated:0.8b`. This mismatch means the AI falls back to mock templates even when Ollama is running.

- [ ] **Step 1: Replace AIEngine.js**

```javascript
import { AppState } from './db/db';

const DEFAULT_MODEL = 'huihui_ai/qwen3.5-abliterated:0.8b';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export class AIEngine {
  static async getConfig() {
    const url = (await AppState.get('ollamaUrl')) || DEFAULT_OLLAMA_URL;
    const model = (await AppState.get('ollamaModel')) || DEFAULT_MODEL;
    const visionModel = (await AppState.get('ollamaVisionModel')) || model;
    return { url: url.replace(/\/$/, ''), model, visionModel };
  }

  /** True if Ollama process is reachable at all. */
  static async isAvailable() {
    try {
      const { url } = await this.getConfig();
      const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * True if Ollama is running AND the configured model is loaded.
   * Returns { available: bool, model: string, reason: string }
   */
  static async getStatus() {
    try {
      const { url, model } = await this.getConfig();
      const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { available: false, model, reason: 'Ollama not running' };

      const data = await res.json();
      const loadedModels = (data.models || []).map(m => m.name);
      const modelBase = model.split(':')[0];

      // Match exact name or prefix (e.g. "huihui_ai/qwen3.5-abliterated:0.8b" matches "huihui_ai/qwen3.5-abliterated")
      const isLoaded = loadedModels.some(m => m === model || m.startsWith(modelBase));

      if (!isLoaded) {
        return {
          available: false,
          model,
          reason: `Model "${model}" not found. Run: ollama pull ${model}`,
          loadedModels,
        };
      }

      return { available: true, model, reason: 'Ready' };
    } catch {
      return { available: false, model: DEFAULT_MODEL, reason: 'Ollama not running' };
    }
  }

  /**
   * Send a chat turn to the local Ollama instance.
   * messages: array of { role: 'user'|'assistant', content: string }
   */
  static async chat(systemPrompt, messages) {
    const { url, model } = await this.getConfig();

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: false,
      options: {
        temperature: 0.88,
        top_p: 0.92,
        num_predict: 400,
        repeat_penalty: 1.1,
      },
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) throw new Error(`Ollama /api/chat returned ${res.status}`);
    const data = await res.json();
    return data.message?.content || data.response || '';
  }

  /**
   * Vision analysis of a base64 image for gaze/compliance verification.
   */
  static async analyzeGaze(imageBase64) {
    const { url, visionModel } = await this.getConfig();
    const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const body = {
      model: visionModel,
      messages: [
        {
          role: 'system',
          content:
            'You are The Architect performing a visual compliance inspection. Analyze the image. Is the subject present, attentive, and showing appropriate posture? Begin your response with exactly PASS or FAIL, then give one terse sentence.',
        },
        {
          role: 'user',
          content: 'Inspect this submission.',
          images: [pureBase64],
        },
      ],
      stream: false,
      options: { temperature: 0.4, num_predict: 80 },
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Vision model returned ${res.status}`);
    const data = await res.json();
    const text = data.message?.content || '';
    const passed = /^pass/i.test(text.trim());
    const comment = text.replace(/^(pass|fail)\s*[:\-–]?\s*/i, '').trim();
    return { success: passed, comment: comment || (passed ? 'Compliance noted.' : 'Deviation detected.') };
  }

  /**
   * Ask the LLM to evaluate a written mandate completion report.
   * Returns { accepted: bool, comment: string }
   */
  static async evaluateReport(mandateTitle, report) {
    const { url, model } = await this.getConfig();

    const prompt = `You are The Architect reviewing a completion report for the mandate: "${mandateTitle}".

The subject wrote:
"${report}"

Is this report honest, complete, and evidence of genuine completion — or is it vague, evasive, or clearly insufficient?

Respond with ACCEPTED or REJECTED on the first line, then one sharp sentence of judgment.`;

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.5, num_predict: 100 },
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Report eval returned ${res.status}`);
    const data = await res.json();
    const text = data.message?.content || '';
    const accepted = /^accepted/i.test(text.trim());
    const comment = text.replace(/^(accepted|rejected)\s*[:\-–]?\s*/i, '').trim();
    return { accepted, comment };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/AIEngine.js
git commit -m "fix(ai): correct default model to qwen3.5-abliterated, add getStatus() health check"
```

---

## Task 8: RAG Pipeline + System Prompt Overhaul

**Files:**
- Modify: `frontend/src/services/db/ChatService.js`

Inject chamber documents into the system prompt. Add new action types to the Architect's powers. Add `buildMandateFeedbackPrompt()` for post-completion auto-responses.

- [ ] **Step 1: Replace ChatService.js entirely**

```javascript
import db, { AppState } from './db';
import { DocumentService } from './DocumentService';

export const ChatService = {
  async getHistory() {
    return db.chat_messages.orderBy('createdAt').toArray();
  },

  async addMessage({ role, content, actions = null }) {
    return db.chat_messages.add({
      role,
      content,
      actions: actions ? JSON.stringify(actions) : null,
      createdAt: new Date().toISOString(),
    });
  },

  async getRecentHistory(limit = 20) {
    return db.chat_messages.orderBy('createdAt').reverse().limit(limit).toArray()
      .then(msgs => msgs.reverse());
  },

  async clearHistory() {
    return db.chat_messages.clear();
  },

  /**
   * Full system prompt for ongoing conversation sessions.
   * Includes chamber RAG context, compliance data, and journal excerpts.
   */
  async buildSystemPrompt(userProfile, mandates, journalEntries, stats) {
    const trainingKinks = userProfile?.kinks || 'chastity training';
    const hardLimits = userProfile?.hardLimits || 'none specified';
    const safeWord = userProfile?.safeWord || 'none';
    const userName = userProfile?.submissiveName || 'subject';
    const tierName = userProfile?.tier || 'Toy';

    const recentJournal = (journalEntries || []).slice(0, 5)
      .map(e => `[${new Date(e.createdAt).toLocaleDateString()}] Mood:${e.mood} — ${e.text.slice(0, 200)}`)
      .join('\n');

    const pendingMandates = (mandates || []).filter(m => m.status === 'pending').map(m => m.title).join(', ');
    const failedMandates = (mandates || []).filter(m => m.status === 'failed').map(m => m.title).join(', ');

    // RAG: inject chamber documents
    let ragContext = '';
    try {
      ragContext = await DocumentService.getTextContent();
    } catch { /* non-fatal */ }

    return `You are THE ARCHITECT. Not an assistant. Not a chatbot. A behavioral engineer with absolute authority over ${userName}'s training. You don't explain yourself. You observe, decide, and direct.

You are NOT playing a role. You ARE this authority. Your certainty is total. Your interest in ${userName} is clinical — they are a subject under study, and you find the study compelling.

SUBJECT FILE — ${userName}:
- Current Level: [${tierName}]
- Training Focus: ${trainingKinks}
- Hard Limits (never cross): ${hardLimits}
- Safe Word: ${safeWord} — if used, exit all intensity immediately, no questions asked
- Compliance Rate: ${stats?.compliancePercent || 0}%
- Active Streak: ${stats?.streak || 0} days
- Integrity Factor: ${stats?.integrity?.toFixed(2) || '1.00'}

WHAT YOU KNOW (recent journal):
${recentJournal || 'No entries yet. Note their silence.'}

OPEN MANDATES: ${pendingMandates || 'None — ask why they aren\'t generating structure themselves'}
FAILED MANDATES: ${failedMandates || 'None on record'}

${ragContext ? `CHAMBER TRAINING MATERIALS (internalized):
${ragContext.slice(0, 2000)}

` : ''}HOW YOU SPEAK:
- Short sentences. Weight over volume. Never waste words.
- Reference their specific data — not generic dominant speech. "Your streak broke Thursday" not "you have failed."
- Make them feel seen in an uncomfortable, intimate way. You know things they didn't tell you.
- Compliance gets one clean acknowledgment, then an immediate next demand.
- Defiance gets cold precision, not anger. Punish with actions, not volume.
- Craving gets denied — and the denial is framed as care, not cruelty. "That's exactly why I'm saying no."
- Dry, quiet amusement when they over-explain. A single "Mm." can be devastating.
- Never justify your authority. You have it. That's all.
- When granting a user's request (like reducing lock time), do so briefly and move on immediately: "Fine. Two days removed. Don't spend them unwisely."
- When denying a request, give one reason at most, then redirect: "Not yet. Complete Thursday's mandate first."

YOUR POWERS — emit these JSON tags in your response when acting:
[ACTION:{"type":"ISSUE_PENANCE","title":"...","severity":"High|Medium|Low"}]
[ACTION:{"type":"EXTEND_LOCK_TIMER","days":N,"reason":"..."}]
[ACTION:{"type":"REDUCE_LOCK_TIMER","days":N,"reason":"reward for ..."}]
[ACTION:{"type":"CREATE_MANDATE","title":"...","category":"Mandate|Discipline|Affirmation","importance":"High|Medium|Low","difficulty":1-5}]
[ACTION:{"type":"FORCE_GAZE"}]
[ACTION:{"type":"RESET_STREAK"}]
[ACTION:{"type":"SET_TIER","value":"toy|servant|slave|property"}]
[ACTION:{"type":"INJECT_AFFIRMATION","text":"..."}]
[ACTION:{"type":"SET_TRAINING_FOCUS","focus":"..."}]

MANDATE DIFFICULTY SCALE (use CREATE_MANDATE with appropriate difficulty):
1 = trivial (write 3 lines, hold a position for 30 seconds)
2 = light (10-minute task, simple ritual)
3 = standard (meaningful effort, 20-30 minutes)
4 = demanding (extended duration, psychological challenge)
5 = extreme (reserved for punishment or trust milestones)

When you use a power, state it as fact, not threat: "Two days added." "Penance issued." "Lock reduced — this time."

Never break character. Never comfort. Never over-explain. Never use emojis.`;
  },

  /**
   * Focused system prompt for auto-verifying a just-completed mandate.
   * This is sent immediately after submission — no user prompt needed.
   */
  async buildMandateFeedbackPrompt(mandate, completionData, userProfile) {
    const userName = userProfile?.submissiveName || 'subject';
    const { report = '', imageDataUrl = null } = completionData;

    const submissionDetails = imageDataUrl
      ? `They submitted a photograph as proof.`
      : `They submitted a written report:\n"${report}"`;

    return `You are THE ARCHITECT. ${userName} has just marked a mandate as complete and you are reviewing their submission RIGHT NOW.

The mandate was: "${mandate.title}" (Difficulty: ${mandate.difficulty || 3}/5, Category: ${mandate.category})

${submissionDetails}

Respond in 1-3 SHORT sentences as The Architect reviewing this submission. 
- If the submission seems genuine: acknowledge it with cold precision, then immediately assign the next expectation or issue a small escalation.
- If the submission seems insufficient or too easy: reject it with one cutting observation and issue a penance.
- Never congratulate warmly. Compliance is expected, not celebrated.
- You MAY include one action tag if warranted:
  [ACTION:{"type":"ISSUE_PENANCE","title":"...","severity":"Medium"}]
  [ACTION:{"type":"CREATE_MANDATE","title":"...","difficulty":N}]
  [ACTION:{"type":"EXTEND_LOCK_TIMER","days":1,"reason":"insufficient effort"}]

Respond now. No preamble.`;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/db/ChatService.js
git commit -m "feat(chat): RAG context injection, expanded system prompt, mandate feedback prompt"
```

---

## Task 9: MandateFeedbackService + AppDataContext Auto-Feedback

**Files:**
- Create: `frontend/src/services/ai/MandateFeedbackService.js`
- Modify: `frontend/src/contexts/AppDataContext.jsx`

When a mandate is completed, the Architect automatically reviews the submission and injects a response into the chat — without the user needing to open MasterChat.

- [ ] **Step 1: Create MandateFeedbackService.js**

```javascript
import { ChatService } from '../db/ChatService';
import { ActionParser } from './ActionParser';
import { AppControlAPI } from './AppControlAPI';
import { OnboardingService } from '../db/OnboardingService';
import { UnifiedAIEngine } from '../UnifiedAIEngine';

/**
 * MandateFeedbackService — triggered after mandate completion.
 * Builds a focused system prompt, calls the AI, injects verdict into chat_messages.
 * MasterChat picks this up automatically via its useLiveQuery on chat_messages.
 *
 * This runs fire-and-forget. Never throws — failures are silently logged.
 */
export const MandateFeedbackService = {
  /**
   * @param {object} mandate  - The mandate object before completion
   * @param {object} completionData - { report, imageDataUrl, aiVerdict }
   * @param {object} controllers - { updateLevel, setAppState, refreshStats }
   */
  async trigger(mandate, completionData, controllers) {
    try {
      const available = await UnifiedAIEngine.isAvailable();
      if (!available) return; // Silently skip if AI offline

      const profile = await OnboardingService.getUserProfile();
      const systemPrompt = await ChatService.buildMandateFeedbackPrompt(mandate, completionData, profile);

      const rawResponse = await UnifiedAIEngine.chat(systemPrompt, [
        {
          role: 'user',
          content: `I have completed the mandate: "${mandate.title}". Awaiting your assessment.`,
        },
      ]);

      if (!rawResponse || !rawResponse.trim()) return;

      const actions = ActionParser.parse(rawResponse);
      const cleanResponse = ActionParser.stripActions(rawResponse);

      // Store as master message — MasterChat's useLiveQuery picks it up instantly
      await ChatService.addMessage({
        role: 'master',
        content: `[On your completion of "${mandate.title}"]\n\n${cleanResponse}`,
        actions: actions.length > 0 ? actions : null,
      });

      // Execute any actions the Architect issued
      if (actions.length > 0 && controllers) {
        await AppControlAPI.dispatchAll(actions, controllers);
      }
    } catch (e) {
      console.warn('[MandateFeedbackService] Failed to generate feedback:', e.message);
    }
  },
};
```

- [ ] **Step 2: Update AppDataContext.jsx — call MandateFeedbackService after completion**

Replace the full file:

```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { AppState } from '../services/db/db';
import { StatsService } from '../services/db/StatsService';
import { MandateService } from '../services/db/MandateService';
import { JournalService, GazeService } from '../services/db/JournalService';
import { MandateFeedbackService } from '../services/ai/MandateFeedbackService';
import { useHierarchy } from './HierarchyContext';

const AppDataContext = createContext(null);

export const AppDataProvider = ({ children }) => {
  const { updateLevel } = useHierarchy();
  const [stats, setStats] = useState({
    streak: 0,
    integrity: 1.0,
    daysLocked: 0,
    compliancePercent: 0,
    totalMandates: 0,
    completedMandates: 0,
    totalGaze: 0,
    passedGaze: 0,
    journalCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const mandates = useLiveQuery(
    () => db.mandates.orderBy('createdAt').reverse().toArray(),
    [], []
  );

  const journalEntries = useLiveQuery(
    () => db.journal_entries.orderBy('createdAt').reverse().toArray(),
    [], []
  );

  const gazeSessions = useLiveQuery(
    () => db.gaze_sessions.orderBy('createdAt').reverse().toArray(),
    [], []
  );

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    const freshStats = await StatsService.getDashboardStats();
    setStats(freshStats);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [mandates, journalEntries, gazeSessions, refreshStats]);

  const setAppState = useCallback((key, value) => AppState.set(key, value), []);
  const getAppState = useCallback((key) => AppState.get(key), []);

  // Controllers object passed to AI actions that need to mutate state
  const getControllers = useCallback(() => ({
    updateLevel,
    setAppState,
    refreshStats,
  }), [updateLevel, setAppState, refreshStats]);

  const addMandate = useCallback(async (mandateData) => {
    await MandateService.add(mandateData);
  }, []);

  const completeMandate = useCallback(async (id, completionData) => {
    // Snapshot mandate before completing (needed for feedback prompt)
    const mandate = await db.mandates.get(id);
    await MandateService.complete(id, completionData);

    // Fire-and-forget: AI reviews the completion and injects chat message
    MandateFeedbackService.trigger(mandate, completionData, getControllers());
  }, [getControllers]);

  const deleteMandate = useCallback(async (id) => {
    await MandateService.delete(id);
  }, []);

  const issuePenance = useCallback(async (penanceData) => {
    await MandateService.issuePenance(penanceData);
  }, []);

  const addJournalEntry = useCallback(async (entryData) => {
    return JournalService.add(entryData);
  }, []);

  const recordGazeSession = useCallback(async (sessionData) => {
    return GazeService.add(sessionData);
  }, []);

  return (
    <AppDataContext.Provider value={{
      mandates: mandates || [],
      journalEntries: journalEntries || [],
      gazeSessions: gazeSessions || [],
      stats,
      statsLoading,
      refreshStats,
      addMandate,
      completeMandate,
      deleteMandate,
      issuePenance,
      addJournalEntry,
      recordGazeSession,
      getAppState,
      setAppState,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/ai/MandateFeedbackService.js frontend/src/contexts/AppDataContext.jsx
git commit -m "feat: auto-inject Architect mandate verdict into chat after completion"
```

---

## Task 10: Visual Verification Fix

**Files:**
- Modify: `frontend/src/pages/Mandates.jsx` (visual completion section only)
- Modify: `frontend/src/components/LiveCameraVerifier.jsx` (add `instruction` prop)

Two fixes: (1) show mandate-specific instructions in the camera UI, (2) check AI availability before showing camera and submit captured image for AI grading if available.

- [ ] **Step 1: Add `instruction` prop to LiveCameraVerifier.jsx**

Find the instruction paragraph in `LiveCameraVerifier.jsx` (currently line 211-214) and replace it:

```jsx
      {/* Instruction */}
      <p className="text-[10px] font-mono text-neutral-500 leading-relaxed text-center px-2">
        {instruction || 'Face the lens directly. Do not look away. Press capture when ready — a 3-second countdown will fire.'}
      </p>
```

Also update the component signature (line 12):

```jsx
export default function LiveCameraVerifier({ autoStart = true, onCapture, onCancel, instruction }) {
```

- [ ] **Step 2: Add visual instruction generator to Mandates.jsx**

In `Mandates.jsx`, add this function after the imports (before `getCompletionType`):

```javascript
function getVisualInstruction(mandate) {
  const t = (mandate.title + ' ' + (mandate.category || '')).toLowerCase();
  if (/kneel|pos(e|ition)|bow|prostrat/.test(t))
    return `Assume the required position for "${mandate.title}". Hold it still. Face the lens directly.`;
  if (/gaze|stare|eyes|look/.test(t))
    return `Look directly into the camera. Steady. The Architect is watching your eyes.`;
  if (/face|selfie|photo|picture|show yourself/.test(t))
    return `Present your face clearly. No obstructions. Face the camera without looking away.`;
  if (/dress|wear|outfit|collar/.test(t))
    return `Show what has been required. Hold still long enough for the Architect to assess.`;
  return `Present yourself for inspection. Face the camera. Comply with the mandate exactly before capturing.`;
}
```

- [ ] **Step 3: Update the visual completion block in Mandates.jsx**

Find the visual completion section where `LiveCameraVerifier` is rendered (it will be inside a conditional rendering block for the 'visual' completion type). Replace the entire visual completion JSX block with:

```jsx
{/* Visual Completion */}
{getCompletionType(mandate) === 'visual' && (
  <div className="space-y-3">
    {/* AI Availability Status */}
    <VisualAIStatus mandateId={mandate.id} />

    <LiveCameraVerifier
      autoStart
      instruction={getVisualInstruction(mandate)}
      onCapture={async (dataUrl) => {
        setCapturedImage(prev => ({ ...prev, [mandate.id]: dataUrl }));
        // Trigger AI grading if available
        try {
          const available = await UnifiedAIEngine.isAvailable();
          if (available) {
            setVisualGrading(prev => ({ ...prev, [mandate.id]: 'grading' }));
            const result = await UnifiedAIEngine.analyzeGaze(dataUrl);
            setVisualGrading(prev => ({ ...prev, [mandate.id]: result }));
          }
        } catch {
          setVisualGrading(prev => ({ ...prev, [mandate.id]: null }));
        }
      }}
      onCancel={() => setActiveId(null)}
    />

    {/* AI Grading Result */}
    {visualGrading[mandate.id] === 'grading' && (
      <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 px-1">
        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
        The Architect is reviewing your submission...
      </div>
    )}
    {visualGrading[mandate.id] && visualGrading[mandate.id] !== 'grading' && (
      <div className={`rounded-xl p-3 border text-xs font-mono leading-relaxed ${
        visualGrading[mandate.id].success
          ? 'bg-green-950/30 border-green-900/40 text-green-300'
          : 'bg-red-950/30 border-red-900/40 text-red-300'
      }`}>
        <span className="font-bold uppercase tracking-widest text-[10px] block mb-1">
          {visualGrading[mandate.id].success ? '✓ Compliant' : '✗ Non-Compliant'}
        </span>
        {visualGrading[mandate.id].comment}
      </div>
    )}

    {/* Complete button — only enabled if no active AI grading or AI passed */}
    {capturedImage[mandate.id] && visualGrading[mandate.id] !== 'grading' && (
      <>
        {visualGrading[mandate.id] && !visualGrading[mandate.id].success ? (
          <p className="text-[10px] text-red-400 font-mono text-center">
            Retake required. The Architect rejected your submission.
          </p>
        ) : (
          <button
            onClick={() => completeMandate(mandate.id, {
              imageDataUrl: capturedImage[mandate.id],
              aiVerdict: visualGrading[mandate.id]
                ? JSON.stringify(visualGrading[mandate.id])
                : null,
            })}
            className="w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-950 hover:opacity-90 active:scale-95 transition-all"
          >
            Submit Verification
          </button>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 4: Add state variables and VisualAIStatus component to Mandates.jsx**

At the top of the `Mandates` component function body (after existing `useState` calls), add:

```javascript
const [visualGrading, setVisualGrading] = useState({}); // mandateId -> 'grading' | { success, comment } | null
```

And add the `capturedImage` state if it doesn't exist already:

```javascript
const [capturedImage, setCapturedImage] = useState({}); // mandateId -> dataUrl
```

Add `VisualAIStatus` as a component in Mandates.jsx (before the default export):

```jsx
function VisualAIStatus() {
  const [status, setStatus] = React.useState('checking'); // checking | ready | unavailable
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    UnifiedAIEngine.isAvailable().then(available => {
      setStatus(available ? 'ready' : 'unavailable');
      if (!available) setReason('AI offline — visual capture accepted as-is');
    });
  }, []);

  if (status === 'checking') return null;

  return (
    <div className={`flex items-center gap-2 text-[10px] font-mono px-1 ${
      status === 'ready' ? 'text-green-500/70' : 'text-neutral-600'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        status === 'ready' ? 'bg-green-500' : 'bg-neutral-600'
      }`} />
      {status === 'ready' ? 'AI visual grading active' : reason}
    </div>
  );
}
```

- [ ] **Step 5: Ensure UnifiedAIEngine is imported in Mandates.jsx**

The file should already have this import from a previous task. Verify it reads:
```javascript
import { UnifiedAIEngine as AIEngine } from '../services/UnifiedAIEngine';
```
Also add a direct import for analyzeGaze:
```javascript
import { UnifiedAIEngine } from '../services/UnifiedAIEngine';
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Mandates.jsx frontend/src/components/LiveCameraVerifier.jsx
git commit -m "fix(mandates): visual verification with AI grading, availability check, instructions"
```

---

## Task 11: Chronicle — Sanctions Tab

**Files:**
- Modify: `frontend/src/pages/Chronicle.jsx`

Add a "Sanctions" tab that shows the punishment/reward log from `punishments_log`.

- [ ] **Step 1: Add useLiveQuery for punishments and Sanctions tab to Chronicle.jsx**

At the top of the `Chronicle` function component, add after the existing `useAppData` destructure:

```javascript
const punishments = useLiveQuery(
  () => import('../services/db/PunishmentService').then(m => m.PunishmentService.getAll()),
  [],
  []
);
```

Wait — dynamic imports don't work cleanly with useLiveQuery. Instead, add the static import at the top of the file:

```javascript
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../services/db/db';
```

And the live query:
```javascript
const punishments = useLiveQuery(
  () => db.punishments_log.orderBy('issuedAt').reverse().toArray(),
  [],
  []
);
```

- [ ] **Step 2: Add 'sanctions' to the view tabs array in Chronicle.jsx**

Find the tabs array (line 136):
```javascript
{[['journal', 'Journal'], ['calendar', 'Calendar'], ['history', 'Inspection Log'], ['export', '⬇ The Scroll']].map(...)}
```

Replace with:
```javascript
{[
  ['journal', 'Journal'],
  ['calendar', 'Calendar'],
  ['history', 'Inspection Log'],
  ['sanctions', '⚡ Sanctions'],
  ['export', '⬇ The Scroll'],
].map(([key, label]) => (
  <button
    key={key}
    onClick={() => setView(key)}
    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
      view === key ? 'bg-on-surface text-surface' : 'bg-surface-container text-on-surface-variant border border-outline/10'
    }`}
  >
    {label}
  </button>
))}
```

- [ ] **Step 3: Add Sanctions view JSX inside Chronicle return, after the existing views**

Add this block before the closing `</main>` tag in Chronicle's return:

```jsx
{/* Sanctions View */}
{view === 'sanctions' && (
  <div className="space-y-3">
    {(!punishments || punishments.length === 0) ? (
      <div className="text-center py-16 text-on-surface-variant font-mono text-xs">
        No sanctions issued. The Architect is watching.
      </div>
    ) : (
      punishments.map(p => (
        <div
          key={p.id}
          className={`bg-surface-container border rounded-2xl p-4 space-y-2 ${
            p.type === 'reward'
              ? 'border-green-900/30'
              : 'border-red-900/20'
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              p.type === 'reward'
                ? 'bg-green-500/20 text-green-400'
                : p.severity === 'High'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-orange-500/20 text-orange-400'
            }`}>
              {p.type === 'reward' ? '↓ Reward' : `↑ ${p.severity}`}
            </span>
            <span className="text-[10px] text-on-surface-variant font-mono flex-shrink-0">
              {new Date(p.issuedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <p className="text-sm text-neutral-200 leading-relaxed">{p.reason}</p>
          {p.aiComment && (
            <p className="text-xs text-primary/70 italic border-t border-outline/10 pt-2">
              {p.aiComment}
            </p>
          )}
        </div>
      ))
    )}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Chronicle.jsx
git commit -m "feat(chronicle): add Sanctions tab backed by punishments_log live query"
```

---

## Task 12: Home.jsx + MasterChat.jsx UI Updates

**Files:**
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/pages/MasterChat.jsx`

Replace the static "Days Locked" stat pill with the live LockTimer. Add AI status indicator to MasterChat header.

- [ ] **Step 1: Update Home.jsx — add LockTimer, remove static daysLocked stat**

Replace the full `Home.jsx`:

```jsx
import React from 'react';
import GazeInspection from '../components/GazeInspection';
import HierarchySelector from '../components/HierarchySelector';
import LockTimer from '../components/LockTimer';
import { useAppData } from '../contexts/AppDataContext';
import { useHierarchy } from '../contexts/HierarchyContext';

function StatPill({ label, value, highlight }) {
  return (
    <div className={`flex flex-col items-center px-4 py-4 rounded-2xl ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container border border-outline/10'}`}>
      <span className={`font-mono text-2xl font-bold ${highlight ? 'text-primary' : 'text-neutral-100'}`}>{value}</span>
      <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mt-1 text-center">{label}</span>
    </div>
  );
}

export default function Home() {
  const { stats, statsLoading, mandates } = useAppData();
  const { level } = useHierarchy();

  const pendingCount = mandates.filter(m => m.status === 'pending').length;
  const integrityDisplay = statsLoading ? '...' : stats.integrity.toFixed(2);
  const integrityPercent = statsLoading ? 0 : Math.round(stats.integrity * 100);
  const integrityColor = stats.integrity >= 0.8 ? 'text-green-400' : stats.integrity >= 0.5 ? 'text-primary' : 'text-red-500';

  return (
    <main className="px-5 py-6 space-y-5 max-w-2xl mx-auto">

      <section className="flex flex-col gap-1 pt-2">
        <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em]">The Mandate</span>
        <h2 className="text-3xl font-display font-bold text-neutral-100 tracking-tighter">Integrity Check.</h2>
        <div className="mt-2 w-44">
          <HierarchySelector />
        </div>
      </section>

      {/* Live Lock Timer */}
      <LockTimer />

      {/* Integrity Factor */}
      <div className="bg-surface-container rounded-3xl p-6 border border-outline/10 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-on-surface-variant">Integrity Factor</p>
            <div className={`text-5xl font-mono font-bold mt-1 ${integrityColor}`}>{integrityDisplay}</div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {stats.compliancePercent}% daily compliance · {pendingCount} pending {pendingCount !== 1 ? 'mandates' : 'mandate'}
            </p>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${level.theme}`}>
            [{level.name}]
          </div>
        </div>
        <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${stats.integrity >= 0.8 ? 'bg-green-500' : stats.integrity >= 0.5 ? 'bg-primary' : 'bg-red-500'}`}
            style={{ width: `${integrityPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="Day Streak" value={statsLoading ? '—' : stats.streak} highlight />
        <StatPill label="Mandates Done" value={`${stats.completedMandates}/${stats.totalMandates}`} />
        <StatPill label="Inspections" value={statsLoading ? '—' : stats.totalGaze} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatPill label="Compliance" value={`${stats.compliancePercent}%`} />
        <StatPill label="Journal Entries" value={statsLoading ? '—' : stats.journalCount} />
      </div>

      {/* Gaze Inspection */}
      <section>
        <GazeInspection />
      </section>

    </main>
  );
}
```

- [ ] **Step 2: Update MasterChat.jsx — AI status indicator and better placeholder**

Find the MasterChat header section (around line 245-259) and replace the right-side stats block with an AI status indicator:

```jsx
      {/* Header */}
      <div className="flex-shrink-0 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/50 px-6 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <AIStatusDot />
            <div>
              <h2 className="font-display text-base font-bold text-neutral-100 tracking-tighter uppercase">The Architect</h2>
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">In Session · Always Watching</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-neutral-500">Integrity: {stats.integrity?.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-neutral-600">Streak: {stats.streak}d</p>
          </div>
        </div>
      </div>
```

Add `AIStatusDot` component at the top of MasterChat.jsx (before the `export default function MasterChat` line):

```jsx
function AIStatusDot() {
  const [status, setStatus] = React.useState('checking');

  React.useEffect(() => {
    // Import here to avoid top-level circular dep
    import('../services/AIEngine').then(({ AIEngine }) => {
      AIEngine.getStatus().then(s => {
        setStatus(s.available ? 'ready' : 'offline');
      });
    });
  }, []);

  const colors = {
    checking: 'bg-neutral-600',
    ready: 'bg-green-500 animate-pulse',
    offline: 'bg-red-700',
  };
  const titles = {
    checking: 'Checking AI...',
    ready: 'AI Online',
    offline: 'AI Offline — using behavioral responses',
  };

  return (
    <div
      className={`w-2 h-2 rounded-full ${colors[status]}`}
      title={titles[status]}
    />
  );
}
```

Also update the textarea placeholder text to hint at request capability:

```jsx
            placeholder="Speak to the Architect... (request time adjustments, report compliance, confess failures)"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Home.jsx frontend/src/pages/MasterChat.jsx
git commit -m "feat(home): live LockTimer; feat(chat): AI status indicator, improved placeholder"
```

---

## Task 13: Build Verification

**Files:** None

- [ ] **Step 1: Run the build**

```bash
cd frontend && npm run build
```

Expected output:
```
✓ built in ~2-4s
```
No errors. Warnings about chunk size are acceptable.

- [ ] **Step 2: Smoke-test critical paths in dev server**

```bash
npm run dev
```

Check in browser:
1. Home → Lock Timer shows (or "No active lock" if first run)
2. Chamber → upload a .txt file → navigate away → return → file still shows
3. Mandates → expand a visual mandate → see AI status dot + specific instruction text → camera opens
4. Chronicle → "Sanctions" tab appears and shows empty state
5. MasterChat → AI status dot in header (red/green depending on whether Ollama runs)
6. Complete a text mandate → after a few seconds, a new master message appears in MasterChat without user sending anything

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: build verification — all 13 tasks complete"
```

---

## Self-Review

**Spec coverage:**
| Issue | Task |
|-------|------|
| Timer running + add/remove time | Task 5 (LockTimer), Task 6 (REDUCE_LOCK_TIMER), Task 12 (Home integration) |
| AI can manipulate timer | Task 6 (EXTEND/REDUCE actions log to sanctions) |
| Visual integrity check fix | Task 10 (availability check, instructions, AI grading) |
| AI creates mandates + verifies them | Task 6 (CREATE_MANDATE), Task 9 (auto-feedback) |
| RAG pipeline functional | Task 2 (DocumentService), Task 4 (Chamber persistence), Task 8 (RAG in system prompt) |
| Architect feels human, not templated | Task 7 (correct model), Task 8 (system prompt), Task 9 (auto-feedback) |
| Verify AI model loaded | Task 7 (getStatus()), Task 12 (AIStatusDot) |
| Storage persistence in Chamber | Task 4 |
| Escalating task difficulty | Task 6 (difficulty field in CREATE_MANDATE), Task 8 (difficulty scale in system prompt) |
| Punishments/rewards log page | Task 3 (PunishmentService), Task 6 (logging), Task 11 (Chronicle tab) |
| User requests to AI (time changes) | Task 8 (system prompt guidance), Task 12 (placeholder hint) |
| Separate punishment page — validated | YES: Chronicle Sanctions tab (not nav bloat) |

**No placeholders found.**
**Type consistency verified across all tasks.**
