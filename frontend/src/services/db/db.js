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
