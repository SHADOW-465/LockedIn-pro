import db from './db';

export const MandateService = {
  async getAll() {
    return db.mandates.orderBy('createdAt').reverse().toArray();
  },

  async getPending() {
    return db.mandates.where('status').equals('pending').toArray();
  },

  async getCompleted() {
    return db.mandates.where('status').equals('completed').toArray();
  },

  async add({ title, category = 'Mandate', importance = 'Medium', dueDate = null, issuedByMaster = false }) {
    return db.mandates.add({
      title,
      category,
      importance,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueDate,
      issuedByMaster,
    });
  },

  async complete(id, { report = '', imageDataUrl = null, aiVerdict = null } = {}) {
    return db.mandates.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completionReport: report,
      completionImageUrl: imageDataUrl,
      aiVerdict,
    });
  },

  async fail(id) {
    return db.mandates.update(id, {
      status: 'failed',
    });
  },

  async delete(id) {
    return db.mandates.delete(id);
  },

  async issuePenance({ title, severity = 'Medium' }) {
    return db.mandates.add({
      title,
      category: 'Penance',
      importance: severity,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueDate: null,
      issuedByMaster: true,
    });
  },

  // Live reactive query helper — returns a Dexie LiveQuery observable
  liveAll() {
    return db.mandates.orderBy('createdAt').reverse();
  }
};
