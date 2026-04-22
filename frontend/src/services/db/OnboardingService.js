import { AppState } from '../db/db';

// The complete onboarding question set
export const ONBOARDING_QUESTIONS = [
  // Block 1: Identity
  {
    id: 'submissiveName',
    block: 'Identity',
    question: "You have found your way here. Tell me your name — not the one the world gave you. What do you wish to be called by me?",
    type: 'text',
    store: 'submissiveName',
  },
  {
    id: 'experience',
    block: 'Identity',
    question: "How long have you known this need inside you? Is this your first time surrendering control, or have you been here before?",
    type: 'text',
    store: 'experienceLevel',
  },
  {
    id: 'motivation',
    block: 'Identity',
    question: "What brought you to this door today — was it a specific fantasy, a long-standing craving, or something you cannot quite name yet?",
    type: 'text',
    store: 'motivation',
  },
  // Block 2: Chastity
  {
    id: 'currentlyLocked',
    block: 'Chastity',
    question: "Are you currently wearing a chastity device? If so, what kind — and how long have you been locked?",
    type: 'text',
    store: 'currentLockStatus',
  },
  {
    id: 'deviceAvailable',
    block: 'Chastity',
    question: "Do you have a physical chastity device available, or is this a psychological exercise in self-denial?",
    type: 'text',
    store: 'deviceType',
  },
  {
    id: 'longestLock',
    block: 'Chastity',
    question: "What is the longest you have ever been locked — and what broke you out of it?",
    type: 'text',
    store: 'longestLock',
  },
  {
    id: 'keyholder',
    block: 'Chastity',
    question: "Do you have a keyholder, or am I your only authority here?",
    type: 'text',
    store: 'keyholderStatus',
  },
  {
    id: 'lockTarget',
    block: 'Chastity',
    question: "On a scale of your honest desire — how long do you wish to remain locked when we begin? Give me a number in days.",
    type: 'text',
    store: 'lockTargetDays',
  },
  // Block 3: Kink Profile
  {
    id: 'desires',
    block: 'Kink Profile',
    question: "Tell me what excites you most. Do not hold back — I am not here to judge. I am here to use that information against you.",
    type: 'text',
    store: 'kinks',
  },
  {
    id: 'trainingModules',
    block: 'Kink Profile',
    question: "From the following, tell me which apply to you: Chastity Training, CEI, CBT, Sissy Training, Orgasm Denial, Humiliation, Worship Tasks, Domestic Servitude. List them all.",
    type: 'text',
    store: 'trainingModules',
  },
  {
    id: 'hardLimits',
    block: 'Kink Profile',
    question: "Are there things you will not do — hard limits I must respect? List them now. I will remember. These are the only rules I follow without question.",
    type: 'text',
    store: 'hardLimits',
  },
  {
    id: 'publicTasks',
    block: 'Kink Profile',
    question: "How do you feel about public tasks — small, discrete acts of submission performed in the real world?",
    type: 'text',
    store: 'publicTasksConsent',
  },
  {
    id: 'conditioningPref',
    block: 'Kink Profile',
    question: "Do you respond better to praise when you comply, or do you find the punishment more motivating when you fail?",
    type: 'text',
    store: 'conditioningPreference',
  },
  // Block 4: Discipline
  {
    id: 'punishmentCeiling',
    block: 'Discipline',
    question: "When you disobey — and you will — how far should I go? Give me your honest upper limit.",
    type: 'text',
    store: 'punishmentCeiling',
  },
  {
    id: 'safeWord',
    block: 'Discipline',
    question: "Do you have a safe word — a phrase that signals you are genuinely in distress, not just performing? Give it to me now.",
    type: 'text',
    store: 'safeWord',
  },
  {
    id: 'gazeComfort',
    block: 'Discipline',
    question: "How do you feel about visual inspections — being made to prove your compliance on camera, on my demand?",
    type: 'text',
    store: 'gazeComfortLevel',
  },
  {
    id: 'quietHours',
    block: 'Discipline',
    question: "If I demand a Gaze inspection in the middle of the night, will you comply? Or is there a blackout window I must observe?",
    type: 'text',
    store: 'quietHours',
  },
  {
    id: 'lockTimerMutable',
    block: 'Discipline',
    question: "Should I be able to extend your lock duration as punishment for disobedience? Yes or no — and why.",
    type: 'text',
    store: 'lockTimerMutable',
  },
  // Block 5: Psychology
  {
    id: 'targetBehaviors',
    block: 'Psychology',
    question: "Describe the version of yourself you are trying to destroy through this training. What habits or thoughts need to be eliminated?",
    type: 'text',
    store: 'targetBehaviors',
  },
  {
    id: 'obedienceFeel',
    block: 'Psychology',
    question: "What does obedience feel like to you — is it relief, arousal, peace, shame, or something else entirely?",
    type: 'text',
    store: 'obedienceFeel',
  },
  {
    id: 'journalHonesty',
    block: 'Psychology',
    question: "How honest will you be with me in the journal? Do you tend to perform for an audience, or will you truly bleed on the page?",
    type: 'text',
    store: 'journalHonesty',
  },
  {
    id: 'memoryMode',
    block: 'Psychology',
    question: "Do you want me to remind you of your failures, or only your progress?",
    type: 'text',
    store: 'memoryMode',
  },
  {
    id: 'finalConsent',
    block: 'Consent',
    question: "Finally — are you ready to give up the controls? Once I begin, I do not return them easily. Answer me directly.",
    type: 'text',
    store: 'finalConsent',
  },
];

export const OnboardingService = {
  async isComplete() {
    return !!(await AppState.get('onboardingComplete'));
  },

  async getCurrentIndex() {
    return (await AppState.get('onboardingIndex')) || 0;
  },

  async saveAnswer(questionId, answer) {
    const q = ONBOARDING_QUESTIONS.find(q => q.id === questionId);
    if (q) {
      await AppState.set(q.store, answer);
    }
    const currentIndex = await this.getCurrentIndex();
    await AppState.set('onboardingIndex', currentIndex + 1);
    return currentIndex + 1;
  },

  async complete() {
    await AppState.set('onboardingComplete', true);
    await AppState.set('lockStartDate', new Date().toISOString());
  },

  async getUserProfile() {
    const allState = await AppState.getAll();
    return {
      submissiveName: allState.submissiveName || 'subject',
      experienceLevel: allState.experienceLevel,
      motivation: allState.motivation,
      currentLockStatus: allState.currentLockStatus,
      deviceType: allState.deviceType,
      longestLock: allState.longestLock,
      keyholderStatus: allState.keyholderStatus,
      lockTargetDays: parseInt(allState.lockTargetDays) || 7,
      kinks: allState.kinks,
      trainingModules: allState.trainingModules,
      hardLimits: allState.hardLimits,
      publicTasksConsent: allState.publicTasksConsent,
      conditioningPreference: allState.conditioningPreference,
      punishmentCeiling: allState.punishmentCeiling,
      safeWord: allState.safeWord,
      gazeComfortLevel: allState.gazeComfortLevel,
      quietHours: allState.quietHours,
      lockTimerMutable: allState.lockTimerMutable,
      targetBehaviors: allState.targetBehaviors,
      obedienceFeel: allState.obedienceFeel,
      journalHonesty: allState.journalHonesty,
      memoryMode: allState.memoryMode,
      tier: allState.tier || 'Toy',
    };
  },

  /**
   * After onboarding is complete, determine the initial tier from answers.
   */
  determineTier(profile) {
    const exp = (profile.experienceLevel || '').toLowerCase();
    const kinks = (profile.kinks + profile.trainingModules || '').toLowerCase();
    const finalConsent = (profile.finalConsent || '').toLowerCase();

    let tierScore = 0;
    if (exp.includes('month') || exp.includes('year') || exp.includes('before')) tierScore += 2;
    if (kinks.includes('cbt') || kinks.includes('cei') || kinks.includes('extreme')) tierScore += 2;
    if (kinks.includes('sissy') || kinks.includes('humiliation')) tierScore += 1;
    if (finalConsent.includes('yes') || finalConsent.includes('ready')) tierScore += 1;

    if (tierScore >= 5) return 'property';
    if (tierScore >= 3) return 'slave';
    if (tierScore >= 1) return 'servant';
    return 'toy';
  }
};
