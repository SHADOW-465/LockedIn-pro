import Dexie from 'dexie';

export const db = new Dexie('LockedInProDB');

db.version(1).stores({
  // User profile & onboarding answers
  app_state: 'key',

  // Mandates/Tasks issued by the Master or user
  // status: 'pending' | 'completed' | 'failed' | 'penance'
  mandates: '++id, title, status, category, importance, createdAt, completedAt, dueDate, issuedByMaster',

  // Journal entries written by user
  journal_entries: '++id, text, mood, createdAt, aiComment, hasPhotos',

  // Photos attached to journal entries or gaze sessions
  photos: '++id, journalEntryId, gazeSessionId, dataUrl, type, createdAt',

  // Gaze inspection sessions
  gaze_sessions: '++id, result, aiComment, imageDataUrl, createdAt, tierAtTime',

  // Chat messages with AI Master
  chat_messages: '++id, role, content, actions, createdAt',

  // Punishment log
  punishments_log: '++id, reason, type, severity, issuedAt, resolvedAt, resolved',

  // Training documents in Indoctrination Chamber
  rag_documents: '++id, name, type, content, status, uploadedAt',
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
