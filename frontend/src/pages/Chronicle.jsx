import React, { useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { ScrollGenerator } from '../services/export/ScrollGenerator';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../services/db/db';

const MOODS = ['Obedient', 'Struggling', 'Craving', 'Broken', 'Grateful', 'Defiant', 'Neutral'];

const MOOD_COLORS = {
  Obedient: 'bg-green-500/20 text-green-400',
  Struggling: 'bg-yellow-500/20 text-yellow-400',
  Craving: 'bg-pink-500/20 text-pink-400',
  Broken: 'bg-red-500/20 text-red-400',
  Grateful: 'bg-blue-500/20 text-blue-400',
  Defiant: 'bg-orange-500/20 text-orange-400',
  Neutral: 'bg-neutral-700 text-neutral-400',
};

function JournalCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const preview = entry.text.length > 120 ? entry.text.slice(0, 120) + '...' : entry.text;

  return (
    <div className="bg-surface-container border border-outline/10 rounded-2xl p-4 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${MOOD_COLORS[entry.mood] || MOOD_COLORS.Neutral}`}>
          {entry.mood}
        </span>
        <span className="text-[10px] text-on-surface-variant font-mono flex-shrink-0">
          {new Date(entry.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
        {expanded ? entry.text : preview}
        {entry.text.length > 120 && (
          <button onClick={() => setExpanded(!expanded)} className="text-primary ml-1 text-xs font-bold">
            {expanded ? ' less' : ' more'}
          </button>
        )}
      </p>

      {entry.aiComment && (
        <div className="mt-2 pt-2 border-t border-outline/10">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">⚡ Architect's Note</p>
          <p className="text-xs text-primary/80 italic leading-relaxed">{entry.aiComment}</p>
        </div>
      )}

      {entry.hasPhotos && (
        <div className="flex items-center gap-1 text-[10px] text-on-surface-variant font-mono">
          <span className="material-symbols-outlined text-[14px]">image</span> Photo attached
        </div>
      )}
    </div>
  );
}

export default function Chronicle() {
  const { journalEntries, gazeSessions, stats, addJournalEntry } = useAppData();
  const [view, setView] = useState('journal'); // journal | history | calendar | export
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [entryText, setEntryText] = useState('');
  const [entryMood, setEntryMood] = useState('Neutral');
  const [saving, setSaving] = useState(false);
  // Export options
  const [exportOpts, setExportOpts] = useState({ includePhotos: true, includeAiComments: true, includeStats: true });
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const punishments = useLiveQuery(
    () => db.punishments_log.orderBy('issuedAt').reverse().toArray(),
    [],
    []
  );

  const handleExport = async () => {
    setExporting(true);
    setExportDone(false);
    try {
      await ScrollGenerator.downloadHTML(exportOpts);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryText.trim()) return;
    setSaving(true);
    await addJournalEntry({ text: entryText.trim(), mood: entryMood });
    setEntryText('');
    setEntryMood('Neutral');
    setShowNewEntry(false);
    setSaving(false);
  };

  // Calendar helpers
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const getDayStatus = (day) => {
    const date = new Date(currentYear, currentMonth, day);
    const dateStr = date.toDateString();
    const hasCompliance = journalEntries.some(e => new Date(e.createdAt).toDateString() === dateStr);
    const failedGaze = gazeSessions.some(s => new Date(s.createdAt).toDateString() === dateStr && s.result === 'failed');
    const passedGaze = gazeSessions.some(s => new Date(s.createdAt).toDateString() === dateStr && s.result === 'passed');
    if (failedGaze) return 'failed';
    if (passedGaze) return 'passed';
    if (hasCompliance) return 'compliance';
    return null;
  };

  return (
    <div className="bg-background text-on-surface">
      <main className="px-4 py-6 max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="pt-4 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tighter">The Chronicle</h2>
            <p className="text-xs text-on-surface-variant mt-1 font-mono">
              {journalEntries.length} entries · {stats.streak} day streak · {stats.totalGaze} inspections
            </p>
          </div>
          {view === 'journal' && (
            <button
              onClick={() => setShowNewEntry(true)}
              className="px-4 py-2 bg-on-surface text-surface rounded-full text-[10px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
            >
              + Write
            </button>
          )}
        </div>

        {/* View Tabs */}
        <div className="flex gap-2">
          {[
            ['journal', 'Journal'],
            ['calendar', 'Calendar'],
            ['history', 'Inspection Log'],
            ['sanctions', '⚡ Sanctions'],
            ['export', '⬇ The Scroll'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                view === key ? 'bg-on-surface text-surface' : 'bg-surface-container text-on-surface-variant border border-outline/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Journal View */}
        {view === 'journal' && (
          <div className="space-y-3">
            {journalEntries.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant font-mono text-xs">
                The Confessional is empty. Write your first entry.
              </div>
            ) : (
              journalEntries.map(entry => <JournalCard key={entry.id} entry={entry} />)
            )}
          </div>
        )}

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="bg-surface-container rounded-2xl p-4 border border-outline/10">
            <div className="text-center mb-4">
              <p className="font-display font-bold text-lg">
                {today.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[9px] text-on-surface-variant font-bold uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const status = getDayStatus(day);
                const isToday = day === today.getDate();
                return (
                  <div
                    key={day}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-mono transition-all ${
                      isToday ? 'ring-1 ring-primary' : ''
                    } ${
                      status === 'passed' ? 'bg-green-500/20 text-green-400' :
                      status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      status === 'compliance' ? 'bg-primary/20 text-primary' :
                      'text-on-surface-variant'
                    }`}
                  >
                    {day}
                    {status && <div className="w-1 h-1 rounded-full mt-0.5 bg-current opacity-70" />}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-4 justify-center flex-wrap">
              {[['bg-green-500', 'Passed'], ['bg-red-500', 'Failed'], ['bg-primary', 'Journal']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${color} opacity-70`} />
                  <span className="text-[9px] text-on-surface-variant uppercase tracking-widest">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inspection History */}
        {view === 'history' && (
          <div className="space-y-3">
            {gazeSessions.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant font-mono text-xs">
                No inspection history. Face the Architect.
              </div>
            ) : (
              gazeSessions.map(session => (
                <div key={session.id} className={`p-4 rounded-2xl border ${session.result === 'passed' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${session.result === 'passed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {session.result === 'passed' ? '✓ Passed' : '✗ Failed'}
                      </span>
                      <span className="text-[9px] text-on-surface-variant font-mono">[{session.tierAtTime}]</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono flex-shrink-0">
                      {new Date(session.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {session.aiComment && (
                    <p className="text-xs mt-2 font-mono text-on-surface-variant leading-relaxed">{session.aiComment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Sanctions View */}
        {view === 'sanctions' && (
          <div className="space-y-3">
            {(!punishments || punishments.length === 0) ? (
              <div className="text-center py-16 text-on-surface-variant font-mono text-xs">
                No sanctions issued. The Architect is watching.
              </div>
            ) : (
              punishments.map(p => (
                <div
                  key={p.id}
                  className={`bg-surface-container border rounded-2xl p-4 space-y-2 ${
                    p.type === 'reward'
                      ? 'border-green-900/30'
                      : 'border-red-900/20'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      p.type === 'reward'
                        ? 'bg-green-500/20 text-green-400'
                        : p.severity === 'High'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {p.type === 'reward' ? '↓ Reward' : `↑ ${p.severity}`}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono flex-shrink-0">
                      {new Date(p.issuedAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-200 leading-relaxed">{p.reason}</p>
                  {p.aiComment && (
                    <p className="text-xs text-primary/70 italic border-t border-outline/10 pt-2">
                      {p.aiComment}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Scroll Export View */}
        {view === 'export' && (
          <div className="bg-surface-container border border-outline/10 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold tracking-tighter">The Scroll</h3>
              <p className="text-xs text-on-surface-variant font-mono mt-1 leading-relaxed">Your entire journey, compiled into a single document. Every confession. Every inspection. Every failure and every surrender.</p>
            </div>

            {/* Options */}
            <div className="space-y-1">
              {[
                ['includeStats', 'Include Statistics Overview'],
                ['includePhotos', 'Include Attached Photos'],
                ['includeAiComments', "Include Architect's Notes"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between py-3 border-b border-outline/10 cursor-pointer">
                  <span className="text-sm text-on-surface">{label}</span>
                  <button
                    role="switch"
                    aria-checked={exportOpts[key]}
                    onClick={() => setExportOpts(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${exportOpts[key] ? 'bg-primary' : 'bg-neutral-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${exportOpts[key] ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </label>
              ))}
            </div>

            {/* Contents preview */}
            <div className="bg-neutral-950 rounded-xl p-4 border border-outline/10">
              <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-3">Document will contain</p>
              <ul className="space-y-1.5">
                {[
                  '📄 Cover page — subject name, tier, lock start date',
                  exportOpts.includeStats && '📊 Full compliance statistics',
                  `📝 ${journalEntries.length} journal ${journalEntries.length === 1 ? 'entry' : 'entries'} with mood tags`,
                  exportOpts.includePhotos && '🖼 Embedded photos (no external links)',
                  exportOpts.includeAiComments && '⚡ Architect commentary per entry',
                  `👁 ${gazeSessions.length} Gaze inspection ${gazeSessions.length === 1 ? 'record' : 'records'}`,
                  '📅 Generation timestamp and footer',
                ].filter(Boolean).map((item, i) => (
                  <li key={i} className="text-xs font-mono text-on-surface-variant">{item}</li>
                ))}
              </ul>
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${
                exportDone
                  ? 'bg-green-500 text-white'
                  : 'bg-on-surface text-surface hover:opacity-90 active:scale-95'
              } disabled:opacity-50`}
            >
              {exporting ? 'Generating Document...' : exportDone ? '✓ Downloaded Successfully' : 'Download The Scroll'}
            </button>

            <p className="text-[10px] text-on-surface-variant font-mono text-center">
              Self-contained HTML file · Opens in any browser · Print to PDF · No internet required
            </p>
          </div>
        )}
      </main>

      {/* New Journal Entry Modal */}
      {showNewEntry && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-background/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-surface-container border-t border-outline/20 rounded-t-[32px] p-6 pb-10 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-display font-bold">The Confessional</h3>
                <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">The Architect reads every word.</p>
              </div>
              <button onClick={() => setShowNewEntry(false)} className="text-on-surface-variant hover:text-neutral-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              {/* Mood selector */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2 block">Current State</label>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map(mood => (
                    <button
                      type="button"
                      key={mood}
                      onClick={() => setEntryMood(mood)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                        entryMood === mood
                          ? (MOOD_COLORS[mood] || 'bg-primary/20 text-primary')
                          : 'bg-surface-container-low text-on-surface-variant border border-outline/10'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                autoFocus
                value={entryText}
                onChange={e => setEntryText(e.target.value)}
                placeholder="Write your confession..."
                rows={6}
                className="w-full bg-surface-container-low border border-outline/10 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary outline-none resize-none leading-relaxed"
              />

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNewEntry(false)} className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest border border-outline/20 hover:bg-on-surface/5 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !entryText.trim()}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-on-surface text-surface hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
