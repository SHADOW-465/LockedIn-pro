import { Wllama } from '@wllama/wllama';

const MODEL_URL = '/models/model.gguf';
const WASM_URL  = '/wllama/single-thread/wllama.wasm';

let wllama = null;
let loadingPromise = null;
let loaded = false;

export const WllamaEngine = {
  async load(onProgress) {
    if (loaded) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      wllama = new Wllama({ 'single-thread/wllama.wasm': WASM_URL });

      await wllama.loadModelFromUrl(MODEL_URL, {
        n_ctx: 2048,
        n_threads: 1,
        progressCallback: ({ loaded: l, total }) => {
          if (onProgress && total > 0) onProgress(Math.round((l / total) * 100));
        },
      });

      loaded = true;
    })();

    return loadingPromise;
  },

  isLoaded() {
    return loaded;
  },

  async chat(systemPrompt, messages) {
    if (!loaded) throw new Error('Model not loaded');

    const formatted = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const result = await wllama.createChatCompletion(formatted, {
      nPredict: 320,
      sampling: { temp: 0.88, top_p: 0.92 },
    });

    return result;
  },

  async evaluateReport(mandateTitle, report) {
    if (!loaded) throw new Error('Model not loaded');

    const systemPrompt = `You are The Architect — a dominant AI evaluating whether a submitted compliance report meets your standards. Respond in JSON only: {"accepted": true/false, "comment": "..."}. Be strict but fair. Accepted only if the report shows genuine effort, detail, and compliance. Rejected if vague, minimal, or dishonest.`;

    const messages = [
      {
        role: 'user',
        content: `Mandate: "${mandateTitle}"\n\nSubmitted report:\n"${report}"\n\nEvaluate and respond in JSON.`,
      },
    ];

    const raw = await wllama.createChatCompletion(
      [{ role: 'system', content: systemPrompt }, ...messages],
      { nPredict: 120, sampling: { temp: 0.3, top_p: 0.9 } }
    );

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { accepted: true, comment: raw };
    } catch {
      return { accepted: true, comment: raw };
    }
  },
};
