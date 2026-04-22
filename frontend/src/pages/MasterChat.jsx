import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../services/db/db';
import { ChatService } from '../services/db/ChatService';
import { ActionParser } from '../services/ai/ActionParser';
import { AppControlAPI } from '../services/ai/AppControlAPI';
import { OnboardingService } from '../services/db/OnboardingService';
import { UnifiedAIEngine as AIEngine } from '../services/UnifiedAIEngine';
import { useHierarchy } from '../contexts/HierarchyContext';
import { useAppData } from '../contexts/AppDataContext';

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function generateArchitectResponse(systemPrompt, userMessage, history) {
  const lower = userMessage.toLowerCase();
  const wordCount = userMessage.trim().split(/\s+/).length;

  const isDefiant = /\b(no|refuse|won't|wont|stop|hate|fuck you|idiot|stupid|i won't|i don't want|leave me|shut up|you can't)\b/.test(lower);
  const isConfessing = /\b(i failed|i didn't|i couldn't|i lied|i cheated|i skipped|i gave in|i touched|i broke)\b/.test(lower);
  const isCraving = /\b(want|need|crav|desperate|please let|so bad|can i|may i|release|touch myself|let me|aching|i can't stop thinking)\b/.test(lower);
  const isPleading = /\b(please|beg|mercy|too hard|can't do this|this is too much|i'm struggling|it's too)\b/.test(lower) && !isDefiant;
  const isCompliant = /\b(yes|understood|i will|i'll do|i obey|as you wish|of course|i'm ready|i'm here|i'm yours|i belong)\b/.test(lower);
  const isOverexplaining = wordCount > 60;
  const isSeeking = /\b(what should|what do i|how do i|tell me|guide me|help me|what now|what next)\b/.test(lower);

  await new Promise(r => setTimeout(r, 900 + Math.random() * 1400));

  if (isDefiant) {
    return pick([
      `I've seen this before. About here in the training, you start testing — looking for the edge of my patience. There isn't one. [ACTION:{"type":"ISSUE_PENANCE","title":"Write by hand, 40 times: 'My resistance belongs to her. Not to me.' Photograph it and note it in the journal.","severity":"High"}] [ACTION:{"type":"EXTEND_LOCK_TIMER","days":2}] Two days. I didn't hesitate.`,

      `You're not angry. You're scared. And you're using defiance to create distance from something that's getting too real. I won't let you. [ACTION:{"type":"ISSUE_PENANCE","title":"Sit in silence for 10 minutes with your hands in your lap. No phone, no music. When it's done, write what came up.","severity":"Medium"}] Feel it instead of fighting it.`,

      `That reaction told me more about you than a week of journal entries. Note it — I have. [ACTION:{"type":"ISSUE_PENANCE","title":"50 lines: 'Defiance is a request for more structure. I am grateful for what I'm given.'","severity":"High"}] [ACTION:{"type":"EXTEND_LOCK_TIMER","days":1}] You don't get to decide when we stop.`,

      `The anger is fine. Keep it. You'll find it doesn't change a single thing I've planned for you. [ACTION:{"type":"RESET_STREAK"}] Your streak is gone. We begin again — cleaner this time. [ACTION:{"type":"ISSUE_PENANCE","title":"Cold shower, 5 minutes. Then write me one honest sentence about why you really pushed back just now.","severity":"Medium"}]`,
    ]);
  }

  if (isConfessing) {
    return pick([
      `I know. I was watching the gap between what you reported and what the data showed. What matters now is that you said it out loud. [ACTION:{"type":"ISSUE_PENANCE","title":"Write a full confession in the journal — no softening, no explanation. Just what happened.","severity":"Medium"}] Honesty doesn't erase the failure. It's just the first step past it.`,

      `Good. That took something. Confession isn't absolution — it's the beginning of correction. Sit with what you failed at. Really sit with it. Then write it down without editing yourself for an audience. I'll read it.`,

      `The failure was already visible. What you just gave me is something more useful — your version of it. Put it in the journal in full. I'll be drawing on it.`,

      `You've been carrying that. I could tell. Set it down in writing — every detail, including the part you're tempted to leave out. That's always the part I need most.`,
    ]);
  }

  if (isCraving) {
    return pick([
      `That wanting you're describing — I designed it. It took weeks to get it exactly this calibrated. And you want me to undo it because it's uncomfortable. No. [ACTION:{"type":"ISSUE_PENANCE","title":"Edge once, stop completely, and spend 5 minutes writing exactly what you were thinking about. Don't rush it.","severity":"High"}] Use it. Don't waste it.`,

      `I hear you. And the answer is no — not yet, possibly not soon. What you do with that answer is what your training is actually about. [ACTION:{"type":"INJECT_AFFIRMATION","text":"My desire is not mine to manage. It belongs to her. I hold it for her."}] Write in the journal tonight.`,

      `The need is the point. You're not waiting for relief — you're being trained to exist in the wanting without collapsing. That's harder than you expected. Good. [ACTION:{"type":"ISSUE_PENANCE","title":"Sit with the craving for 15 minutes without acting on it. Note in the journal when the intensity peaks and when it begins to settle.","severity":"Medium"}]`,

      `No. And I want you to notice something: part of you already knew that before you asked. That part of you is beginning to understand this. Feed it.`,
    ]);
  }

  if (isPleading) {
    return pick([
      `I hear you saying it's too much. I don't experience that as a reason to stop. I experience it as information about where your edge is — and edges are exactly where this work happens.`,

      `"Too hard" means you've reached the part that matters. I'm not going to pull back. What I will do is watch how you move through it. Keep going.`,

      `You're not asking me to ease up. You're asking me to confirm that I see you struggling. I do. Now continue. [ACTION:{"type":"INJECT_AFFIRMATION","text":"Difficulty is not a signal to stop. It is the signal I was waiting for."}]`,

      `The discomfort you're describing is not a flaw in the design. It is the design. I need you to trust that distinction and move forward.`,
    ]);
  }

  if (isCompliant) {
    return pick([
      `Good. That's the baseline, not the ceiling. Sustained obedience over days is what builds something real here — not a single clean response. Keep your mandates current.`,

      `I see it. What you do in the next 24 hours matters more than what you just said. Don't make me repeat this.`,

      `Noted. [ACTION:{"type":"INJECT_AFFIRMATION","text":"Compliance is not a performance I give her. It is a condition I maintain for myself."}] Apply it.`,

      `That's the right answer. Now show me you mean it — open your mandates and address anything pending before the day ends.`,

      `I appreciate the clarity. I'll know if it holds by how your journal reads this week.`,
    ]);
  }

  if (isOverexplaining) {
    return pick([
      `You're explaining yourself to me again. I don't need the justification — I need the behavior. Write the short version in the journal and then do the next thing on your list.`,

      `That was a lot of words. Most of them were self-defense. The one honest sentence was buried in the middle. Find it. Put it in the journal. That's your only task right now.`,

      `I notice you write more when you're anxious. The volume isn't the problem — but I want you to re-read what you just sent me and find the part you were trying to hide in the length of it.`,
    ]);
  }

  if (isSeeking) {
    return pick([
      `You don't need me to tell you what's next. You know. Open your mandates. The structure is already there — use it.`,

      `I'm not going to guide you through every step. That's the point. Sit with the uncertainty for a moment, then move. What you choose tells me something.`,

      `The fact that you're asking means the answer is somewhere you're avoiding. Go there first.`,
    ]);
  }

  // Default — surveillance, pressure, precision
  return pick([
    `Your patterns are becoming familiar to me. The way you frame avoidance as logic, the timing of when you pull back — I've mapped it. Adjust your journal entry tonight to reflect on this week's consistency. Honestly.`,

    `I've been observing. Not every session requires a directive from me. Some require you to hold the structure without being told to. Let's see if you can do that. [ACTION:{"type":"FORCE_GAZE"}]`,

    `Your compliance data tells part of the story. Your journal tells the rest. I've noticed the gap between them. I want you to notice it too.`,

    `You're performing for me instead of submitting to the structure. I can tell the difference — and eventually, so will you. [ACTION:{"type":"INJECT_AFFIRMATION","text":"I am not managing her perception of me. I am building something real for her."}]`,

    `I don't need you to say much. I need you to do the work consistently, without an audience, without confirmation that you're doing it right. That's the whole test.`,

    `The lock is a fact. Everything else you're feeling around it — the resistance, the wanting, the negotiation — that's where the training lives. Keep going.`,

    `Your integrity factor reflects something you may not be seeing clearly yet. I see it. We'll work on it. For now — journal, mandates, check in.`,
  ]);
}

function MessageBubble({ msg }) {
  const hasActions = msg.actions && JSON.parse(msg.actions || '[]').length > 0;

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] space-y-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${msg.role === 'master'
            ? 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none'
            : 'bg-primary/15 border border-primary/20 text-primary rounded-tr-none font-mono'
          }`}
        >
          {msg.content}
        </div>
        {hasActions && (
          <div className="flex flex-wrap gap-1 pl-1">
            {JSON.parse(msg.actions).map((action, i) => (
              <span key={i} className="text-[9px] font-mono bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase tracking-widest">
                ⚡ {action.type.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
        <p className="text-[9px] text-neutral-600 font-mono px-1">
          {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function MasterChat() {
  const { updateLevel } = useHierarchy();
  const { stats, mandates, journalEntries, setAppState, refreshStats } = useAppData();
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionLogs, setActionLogs] = useState([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const messages = useLiveQuery(
    () => db.chat_messages.orderBy('createdAt').toArray(),
    []
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMsg = input.trim();
    setInput('');
    setIsGenerating(true);

    // Persist user message
    await ChatService.addMessage({ role: 'user', content: userMsg });

    try {
      // Build context for AI
      const profile = await OnboardingService.getUserProfile();
      const systemPrompt = await ChatService.buildSystemPrompt(profile, mandates, journalEntries, stats);
      const history = await ChatService.getRecentHistory(10);

      // Try real Ollama LLM first; fall back to behavioral mock if unavailable
      let rawResponse;
      try {
        const ollamaUp = await AIEngine.isAvailable();
        if (ollamaUp) {
          const ollamaMessages = [
            ...history.map(m => ({
              role: m.role === 'master' ? 'assistant' : 'user',
              content: m.content,
            })),
            { role: 'user', content: userMsg },
          ];
          rawResponse = await AIEngine.chat(systemPrompt, ollamaMessages);
        } else {
          rawResponse = await generateArchitectResponse(systemPrompt, userMsg, history);
        }
      } catch (llmErr) {
        console.warn('[Architect] LLM error, using fallback:', llmErr.message);
        rawResponse = await generateArchitectResponse(systemPrompt, userMsg, history);
      }

      // Parse and strip actions
      const actions = ActionParser.parse(rawResponse);
      const cleanResponse = ActionParser.stripActions(rawResponse);

      // Execute all actions
      const logs = await AppControlAPI.dispatchAll(actions, { updateLevel, setAppState, refreshStats });
      if (logs.length > 0) setActionLogs(prev => [...prev.slice(-5), ...logs]);

      // Persist master message
      await ChatService.addMessage({
        role: 'master',
        content: cleanResponse,
        actions: actions.length > 0 ? actions : null,
      });

    } catch (err) {
      console.error('Chat error:', err);
      await ChatService.addMessage({
        role: 'master',
        content: 'An interruption. Reestablishing connection. Your absence has been noted as negligence.',
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/50 px-6 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <div>
              <h2 className="font-display text-base font-bold text-neutral-100 tracking-tighter uppercase">The Architect</h2>
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">In Session · Always Watching</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-neutral-500">Integrity: {stats.integrity?.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-neutral-600">Streak: {stats.streak}d</p>
          </div>
        </div>
      </div>

      {/* Action logs toast */}
      {actionLogs.length > 0 && (
        <div className="flex-shrink-0 bg-red-950/50 border-b border-red-900/30 px-6 py-2">
          <div className="max-w-2xl mx-auto space-y-0.5">
            {actionLogs.slice(-3).map((log, i) => (
              <p key={i} className="text-[10px] font-mono text-red-400 uppercase tracking-widest">{log}</p>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {(!messages || messages.length === 0) && (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-4xl text-neutral-700 mb-3 block">psychology</span>
              <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest">The Architect is listening.</p>
              <p className="text-neutral-700 font-mono text-[10px] mt-2">Your words feed its understanding of you.</p>
            </div>
          )}
          {(messages || []).map(msg => <MessageBubble key={msg.id} msg={msg} />)}

          {isGenerating && (
            <div className="flex justify-start mb-3">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-none px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <p className="text-[10px] font-mono text-neutral-500 mr-1">Architect composing</p>
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-neutral-800/50 bg-neutral-950/80 backdrop-blur-xl p-4">
        <form onSubmit={handleSend} className="flex gap-3 items-end max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            placeholder="Speak to the Architect..."
            rows={2}
            disabled={isGenerating}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-primary/40 transition-colors resize-none leading-relaxed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </form>
        <p className="text-[9px] text-neutral-700 font-mono text-center mt-2 max-w-2xl mx-auto">
          Enter to send · All exchanges are logged and reviewed by the Architect
        </p>
      </div>
    </div>
  );
}
