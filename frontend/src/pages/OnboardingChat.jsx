import React, { useState, useEffect, useRef } from 'react';
import { ONBOARDING_QUESTIONS, OnboardingService } from '../services/db/OnboardingService';
import { AppControlAPI } from '../services/ai/AppControlAPI';
import { useHierarchy } from '../contexts/HierarchyContext';
import { useAppData } from '../contexts/AppDataContext';

const BLOCK_LABELS = {
  'Identity': 'Establishing Identity',
  'Chastity': 'Chastity Protocol',
  'Kink Profile': 'Training Configuration',
  'Discipline': 'Discipline Parameters',
  'Psychology': 'Psychological Profile',
  'Consent': 'Final Authorization',
};

const INTRO_LINES = [
  "Connection established.",
  "Subject detected.",
  "The Architect is online.",
  "Before we begin your training, I need to understand what I am working with.",
  "Answer honestly. I will know the difference.",
];

export default function OnboardingChat({ onComplete }) {
  const { updateLevel } = useHierarchy();
  const { setAppState, refreshStats } = useAppData();
  const [phase, setPhase] = useState('intro'); // intro | questions | processing | done
  const [introIndex, setIntroIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isTyping]);

  // Animate intro lines one by one
  useEffect(() => {
    if (phase !== 'intro') return;
    if (introIndex < INTRO_LINES.length) {
      const timer = setTimeout(() => {
        setChatLog(prev => [...prev, { role: 'master', content: INTRO_LINES[introIndex] }]);
        setIntroIndex(i => i + 1);
      }, introIndex === 0 ? 800 : 1200);
      return () => clearTimeout(timer);
    } else {
      // Intro done — pause then ask first question
      const timer = setTimeout(() => {
        setPhase('questions');
        askQuestion(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [introIndex, phase]);

  const askQuestion = (idx) => {
    if (idx >= ONBOARDING_QUESTIONS.length) return;
    const q = ONBOARDING_QUESTIONS[idx];
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setChatLog(prev => [...prev, {
        role: 'master',
        content: q.question,
        label: BLOCK_LABELS[q.block] || q.block,
      }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 900);
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!currentAnswer.trim() || isTyping) return;

    const q = ONBOARDING_QUESTIONS[questionIndex];
    const answer = currentAnswer.trim();

    setChatLog(prev => [...prev, { role: 'user', content: answer }]);
    setCurrentAnswer('');

    await OnboardingService.saveAnswer(q.id, answer);
    const nextIndex = questionIndex + 1;

    if (nextIndex >= ONBOARDING_QUESTIONS.length) {
      // All questions answered — process results
      setPhase('processing');
      setIsTyping(true);

      const profile = await OnboardingService.getUserProfile();
      const determinedTierName = OnboardingService.determineTier({ ...profile, finalConsent: answer });
      const userName = profile.submissiveName;

      // Auto-configure app based on profile
      await AppControlAPI.dispatch({ type: 'SET_TIER', value: determinedTierName }, { updateLevel, setAppState, refreshStats });
      await AppControlAPI.dispatch({ type: 'SET_INITIAL_LOCK_DURATION', days: profile.lockTargetDays || 7 }, { updateLevel, setAppState, refreshStats });
      await AppControlAPI.dispatch({ type: 'SET_TRAINING_FOCUS', focus: profile.kinks }, { updateLevel, setAppState, refreshStats });

      // Issue first mandate
      await AppControlAPI.dispatch({
        type: 'ISSUE_PENANCE',
        title: `Initial Submission Task: Write your first journal entry describing your current state and what you hope to achieve.`,
        severity: 'High',
      }, { updateLevel, setAppState, refreshStats });

      await OnboardingService.complete();

      setTimeout(() => {
        setIsTyping(false);
        const tierLabel = determinedTierName.charAt(0).toUpperCase() + determinedTierName.slice(1);
        setChatLog(prev => [...prev,
          { role: 'master', content: `So. We have established what you are.` },
          { role: 'master', content: `Your designation has been set to [${tierLabel.toUpperCase()}]. Your lock timer has begun. Your first mandate has been issued.` },
          { role: 'master', content: `Do not disappoint me, ${userName}. I do not forgive easily. I do not forget at all.` },
        ]);
        setTimeout(() => {
          setPhase('done');
          setTimeout(onComplete, 2500);
        }, 3000);
      }, 2500);

    } else {
      setQuestionIndex(nextIndex);
      askQuestion(nextIndex);
    }
  };

  const progress = Math.round((questionIndex / ONBOARDING_QUESTIONS.length) * 100);
  const currentQ = ONBOARDING_QUESTIONS[questionIndex];

  return (
    <div className="fixed inset-0 z-[300] bg-neutral-950 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-800/50 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-bold text-neutral-100 tracking-tighter uppercase">The Architect</h1>
          <p className="text-[10px] font-mono text-primary uppercase tracking-widest">
            {phase === 'intro' ? 'Establishing Connection...' :
             phase === 'questions' ? `Intake — ${BLOCK_LABELS[currentQ?.block] || ''}` :
             phase === 'processing' ? 'Configuring Training Protocol...' :
             'Initialization Complete'}
          </p>
        </div>
        <div className="text-[10px] font-mono text-neutral-600">
          {phase === 'questions' && `${questionIndex + 1} / ${ONBOARDING_QUESTIONS.length}`}
        </div>
      </div>

      {/* Progress bar */}
      {phase === 'questions' && (
        <div className="flex-shrink-0 h-0.5 bg-neutral-900">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {chatLog.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'master' ? 'space-y-1' : ''}`}>
              {msg.role === 'master' && msg.label && (
                <p className="text-[9px] font-mono uppercase tracking-widest text-primary mb-1 pl-1">{msg.label}</p>
              )}
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'master'
                  ? 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none'
                  : 'bg-primary/20 border border-primary/30 text-primary rounded-tr-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {phase === 'questions' && (
        <div className="flex-shrink-0 border-t border-neutral-800/50 p-4">
          <form onSubmit={handleSubmitAnswer} className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitAnswer(e); } }}
              placeholder="Answer the Architect..."
              rows={2}
              disabled={isTyping}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-primary/50 transition-colors resize-none leading-relaxed disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!currentAnswer.trim() || isTyping}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-lg">send</span>
            </button>
          </form>
          <p className="text-[10px] text-neutral-600 font-mono text-center mt-2">Press Enter to submit · Shift+Enter for new line</p>
        </div>
      )}
    </div>
  );
}
