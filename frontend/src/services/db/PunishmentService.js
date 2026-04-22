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
