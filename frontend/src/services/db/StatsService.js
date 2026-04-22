import db, { AppState } from './db';

export const StatsService = {
  /**
   * Calculates the current compliance streak in days.
   * A "streak day" = any day where at least one mandate was completed and no Gaze failed.
   */
  async getActiveStreak() {
    const allSessions = await db.gaze_sessions.orderBy('createdAt').reverse().toArray();
    const allCompleted = await db.mandates
      .where('status').equals('completed')
      .sortBy('completedAt');

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const nextDate = new Date(checkDate);
      nextDate.setDate(checkDate.getDate() + 1);

      const dayStart = checkDate.getTime();
      const dayEnd = nextDate.getTime();

      // Check if any mandate was completed this day
      const hasCompliance = allCompleted.some(m => {
        const t = new Date(m.completedAt).getTime();
        return t >= dayStart && t < dayEnd;
      });

      // Check if any gaze session failed this day
      const hadFailedGaze = allSessions.some(s => {
        const t = new Date(s.createdAt).getTime();
        return t >= dayStart && t < dayEnd && s.result === 'failed';
      });

      if (hasCompliance && !hadFailedGaze) {
        streak++;
      } else if (i > 0) {
        // Streak broken — stop counting
        break;
      }
    }
    return streak;
  },

  /**
   * Calculates the Integrity Factor (0.0 - 1.0).
   * Based on mandate completion rate, gaze pass rate, and journal consistency.
   */
  async getIntegrityFactor() {
    const totalMandates = await db.mandates.count();
    const completedMandates = await db.mandates.where('status').equals('completed').count();
    const totalGaze = await db.gaze_sessions.count();
    const passedGaze = await db.gaze_sessions.where('result').equals('passed').count();

    if (totalMandates === 0 && totalGaze === 0) return 1.0; // freshly initialized

    const mandateRate = totalMandates > 0 ? completedMandates / totalMandates : 1;
    const gazeRate = totalGaze > 0 ? passedGaze / totalGaze : 1;

    // Weighted: mandates 60%, gaze 40%
    const factor = (mandateRate * 0.6) + (gazeRate * 0.4);
    return Math.round(factor * 100) / 100;
  },

  /**
   * Number of days since chastity lock was started.
   */
  async getDaysLocked() {
    const lockStart = await AppState.get('lockStartDate');
    if (!lockStart) return 0;
    const start = new Date(lockStart);
    const now = new Date();
    const diffMs = now - start;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  },

  /**
   * Percentage of mandates completed today.
   */
  async getTodayCompliancePercent() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const allMandates = await db.mandates.toArray();
    const todayMandates = allMandates.filter(m => {
      const created = new Date(m.createdAt).getTime();
      return created >= today.getTime() && created < tomorrow.getTime();
    });

    if (todayMandates.length === 0) {
      // Fall back to all non-completed vs completed
      const total = await db.mandates.count();
      const done = await db.mandates.where('status').equals('completed').count();
      if (total === 0) return 0;
      return Math.round((done / total) * 100);
    }

    const done = todayMandates.filter(m => m.status === 'completed').length;
    return Math.round((done / todayMandates.length) * 100);
  },

  /**
   * Full snapshot for the Home dashboard.
   */
  async getDashboardStats() {
    const [streak, integrity, daysLocked, compliancePercent] = await Promise.all([
      this.getActiveStreak(),
      this.getIntegrityFactor(),
      this.getDaysLocked(),
      this.getTodayCompliancePercent(),
    ]);

    const totalMandates = await db.mandates.count();
    const completedMandates = await db.mandates.where('status').equals('completed').count();
    const totalGaze = await db.gaze_sessions.count();
    const passedGaze = await db.gaze_sessions.where('result').equals('passed').count();
    const journalCount = await db.journal_entries.count();

    return {
      streak,
      integrity,
      daysLocked,
      compliancePercent,
      totalMandates,
      completedMandates,
      totalGaze,
      passedGaze,
      journalCount,
    };
  }
};
