import db from './db';

export const JournalService = {
  async getAll() {
    return db.journal_entries.orderBy('createdAt').reverse().toArray();
  },

  async add({ text, mood = 'Neutral', photos = [] }) {
    const entryId = await db.journal_entries.add({
      text,
      mood,
      createdAt: new Date().toISOString(),
      aiComment: null,
      hasPhotos: photos.length > 0,
    });

    // Store attached photos
    for (const photoDataUrl of photos) {
      await db.photos.add({
        journalEntryId: entryId,
        gazeSessionId: null,
        dataUrl: photoDataUrl,
        type: 'journal',
        createdAt: new Date().toISOString(),
      });
    }

    return entryId;
  },

  async attachAiComment(id, comment) {
    return db.journal_entries.update(id, { aiComment: comment });
  },

  async getPhotosForEntry(entryId) {
    return db.photos.where('journalEntryId').equals(entryId).toArray();
  },

  async getRecent(limit = 5) {
    return db.journal_entries.orderBy('createdAt').reverse().limit(limit).toArray();
  },

  // Get all text content for RAG context building
  async getRagContext(limit = 10) {
    const entries = await db.journal_entries
      .orderBy('createdAt').reverse().limit(limit).toArray();
    return entries.map(e => `[${new Date(e.createdAt).toLocaleDateString()}] Mood: ${e.mood} — ${e.text}`).join('\n');
  }
};

export const GazeService = {
  async add({ result, aiComment, imageDataUrl, tierAtTime }) {
    const sessionId = await db.gaze_sessions.add({
      result,
      aiComment,
      imageDataUrl: imageDataUrl || null,
      tierAtTime,
      createdAt: new Date().toISOString(),
    });

    // If there is an image, store it in the photos table too for the Journey doc
    if (imageDataUrl) {
      await db.photos.add({
        journalEntryId: null,
        gazeSessionId: sessionId,
        dataUrl: imageDataUrl,
        type: 'gaze',
        createdAt: new Date().toISOString(),
      });
    }

    return sessionId;
  },

  async getAll() {
    return db.gaze_sessions.orderBy('createdAt').reverse().toArray();
  },

  async getRecent(limit = 5) {
    return db.gaze_sessions.orderBy('createdAt').reverse().limit(limit).toArray();
  },

  // Get sessions grouped by date for calendar rendering
  async getByDateRange(startDate, endDate) {
    return db.gaze_sessions
      .where('createdAt')
      .between(startDate.toISOString(), endDate.toISOString())
      .toArray();
  }
};
