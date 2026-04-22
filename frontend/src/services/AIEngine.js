import { AppState } from './db/db';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export class AIEngine {
  static async getConfig() {
    const url = (await AppState.get('ollamaUrl')) || DEFAULT_OLLAMA_URL;
    const model = (await AppState.get('ollamaModel')) || DEFAULT_MODEL;
    return { url: url.replace(/\/$/, ''), model };
  }

  static async isAvailable() {
    try {
      const { url } = await this.getConfig();
      const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Send a chat turn to the local Ollama instance.
   * messages: array of { role: 'user'|'assistant', content: string }
   */
  static async chat(systemPrompt, messages) {
    const { url, model } = await this.getConfig();

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: false,
      options: {
        temperature: 0.88,
        top_p: 0.92,
        num_predict: 320,
        repeat_penalty: 1.1,
      },
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) throw new Error(`Ollama /api/chat returned ${res.status}`);
    const data = await res.json();
    return data.message?.content || data.response || '';
  }

  /**
   * Vision analysis of a base64 image for gaze/compliance verification.
   * Falls back to text-only judgment if the model doesn't support images.
   */
  static async analyzeGaze(imageBase64) {
    const { url, model } = await this.getConfig();
    const visionModel = (await AppState.get('ollamaVisionModel')) || model;
    const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const body = {
      model: visionModel,
      messages: [
        {
          role: 'system',
          content:
            'You are The Architect performing a visual compliance inspection. Analyze the image. Is the subject present, attentive, and showing appropriate posture? Begin your response with exactly PASS or FAIL, then give one terse sentence from The Architect\'s perspective.',
        },
        {
          role: 'user',
          content: 'Inspect this submission.',
          images: [pureBase64],
        },
      ],
      stream: false,
      options: { temperature: 0.4, num_predict: 80 },
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Vision model returned ${res.status}`);
    const data = await res.json();
    const text = data.message?.content || '';
    const passed = /^pass/i.test(text.trim());
    const comment = text.replace(/^(pass|fail)\s*[:\-–]?\s*/i, '').trim();
    return { success: passed, comment: comment || (passed ? 'Compliance noted.' : 'Deviation detected.') };
  }

  /**
   * Ask the LLM to evaluate a written mandate completion report.
   * Returns { accepted: bool, comment: string }
   */
  static async evaluateReport(mandateTitle, report) {
    const { url, model } = await this.getConfig();

    const prompt = `You are The Architect reviewing a completion report for the mandate: "${mandateTitle}".

The subject wrote:
"${report}"

Is this report honest, complete, and evidence of genuine completion — or is it vague, evasive, or clearly insufficient?

Respond with ACCEPTED or REJECTED on the first line, then one sharp sentence of judgment.`;

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.5, num_predict: 100 },
    };

    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Report eval returned ${res.status}`);
    const data = await res.json();
    const text = data.message?.content || '';
    const accepted = /^accepted/i.test(text.trim());
    const comment = text.replace(/^(accepted|rejected)\s*[:\-–]?\s*/i, '').trim();
    return { accepted, comment };
  }
}
