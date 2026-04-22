import { AIEngine } from './AIEngine';
import { WllamaEngine } from './WllamaEngine';

function isCapacitorAndroid() {
  return !!(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === 'android');
}

function isElectron() {
  return !!(window.electronAPI?.isElectron);
}

export const UnifiedAIEngine = {
  _useWllama: null,

  async detectEnvironment() {
    if (this._useWllama !== null) return;

    if (isCapacitorAndroid()) {
      this._useWllama = true;
      return;
    }

    // Electron or browser: try Ollama first
    const ollamaUp = await AIEngine.isAvailable().catch(() => false);
    this._useWllama = !ollamaUp;
  },

  usesWllama() {
    return this._useWllama === true;
  },

  async loadWllama(onProgress) {
    if (!this._useWllama) return;
    await WllamaEngine.load(onProgress);
  },

  isWllamaLoaded() {
    return WllamaEngine.isLoaded();
  },

  async isAvailable() {
    await this.detectEnvironment();
    if (this._useWllama) return WllamaEngine.isLoaded();
    return AIEngine.isAvailable();
  },

  async chat(systemPrompt, messages) {
    await this.detectEnvironment();
    if (this._useWllama) return WllamaEngine.chat(systemPrompt, messages);
    return AIEngine.chat(systemPrompt, messages);
  },

  async evaluateReport(mandateTitle, report) {
    await this.detectEnvironment();
    if (this._useWllama) return WllamaEngine.evaluateReport(mandateTitle, report);
    return AIEngine.evaluateReport(mandateTitle, report);
  },

  async analyzeGaze(imageBase64) {
    await this.detectEnvironment();
    // wllama 0.8B text-only; fall back to Ollama or skip
    if (this._useWllama) return { focused: true, note: 'Vision analysis unavailable on mobile.' };
    return AIEngine.analyzeGaze(imageBase64);
  },
};
