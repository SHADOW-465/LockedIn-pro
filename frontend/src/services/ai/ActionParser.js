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
