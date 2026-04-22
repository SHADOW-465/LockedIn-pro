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
