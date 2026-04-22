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
