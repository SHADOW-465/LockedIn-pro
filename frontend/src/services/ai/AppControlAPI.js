import { AppState } from '../db/db';
import { MandateService } from '../db/MandateService';
import { NotificationService } from '../NotificationService';
import { POSSESSION_LEVELS } from '../../contexts/HierarchyContext';

/**
 * AppControlAPI — the Architect's enforcement arm.
 * Receives validated action objects and mutates application state.
 */
export class AppControlAPI {
  /**
   * Dispatch a single action. Returns a human-readable log of what happened.
   */
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
        refreshStats();
        return `⚡ PENANCE ISSUED: "${action.title}"`;
      }

      case 'EXTEND_LOCK_TIMER': {
        const currentDays = (await AppState.get('lockExtensionDays')) || 0;
        await AppState.set('lockExtensionDays', currentDays + (action.days || 1));
        refreshStats();
        return `🔒 LOCK EXTENDED BY ${action.days || 1} DAY(S)`;
      }

      case 'RESET_STREAK': {
        // Mark all pending mandates as failed to break streak
        await AppState.set('streakResetAt', new Date().toISOString());
        refreshStats();
        return `❌ COMPLIANCE STREAK RESET TO ZERO`;
      }

      case 'FORCE_GAZE': {
        // Signal to the UI that it must immediately open the camera
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

  /**
   * Dispatch multiple actions and return all execution logs.
   */
  static async dispatchAll(actions, controllers) {
    const logs = [];
    for (const action of actions) {
      const log = await this.dispatch(action, controllers);
      if (log) logs.push(log);
    }
    return logs;
  }
}
