import React, { useState, useCallback } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import LiveCameraVerifier from '../components/LiveCameraVerifier';
import { UnifiedAIEngine as AIEngine } from '../services/UnifiedAIEngine';

const IMPORTANCE = ['High', 'Medium', 'Low'];
const CATEGORIES = ['Mandate', 'Penance', 'Discipline', 'Journal', 'Affirmation'];

// Detect whether a mandate requires visual (camera) verification vs written report
function getCompletionType(mandate) {
  const t = mandate.title.toLowerCase();
  const visualTerms = /\b(photo|camera|selfie|show|display|record|capture|face|gaze|image|film|picture|lens|mirror|submit yourself)\b/;
  if (visualTerms.test(t)) return 'visual';
  if (mandate.category === 'Penance' && /\b(kneel|pose|stand|position)\b/.test(t)) return 'visual';
  return 'text';
}

function CompletionTypeIcon({ type }) {
  if (type === 'visual') {
    return (
      <span title="Visual verification required" className="text-[9px] font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
        <span className="material-symbols-outlined text-[11px]">photo_camera</span>
        Visual
      </span>
    );
  }
  return (
    <span title="Written report required" className="text-[9px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
      <span className="material-symbols-outlined text-[11px]">edit_note</span>
      Report
    </span>
  );
}

function MandateCard({ mandate, isActive, onActivate, onComplete, onDelete }) {
  const isPending = mandate.status === 'pending';
  const isMaster = mandate.issuedByMaster;
  const completionType = getCompletionType(mandate);

  const [report, setReport] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState(null); // { accepted, comment }

  const canSubmit = completionType === 'visual'
    ? !!capturedImage
    : report.trim().length >= 15;

  const handleActivate = () => {
    if (!isPending) return;
    // Toggle: deactivate if already active
    onActivate(isActive ? null : mandate.id);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setVerdict(null);

    try {
      // Ask the LLM to evaluate the report (text only; visual passes automatically)
      let aiVerdict = null;
      if (completionType === 'text') {
        const ollamaUp = await AIEngine.isAvailable();
        if (ollamaUp) {
          const result = await AIEngine.evaluateReport(mandate.title, report);
          aiVerdict = result;
          if (!result.accepted) {
            setVerdict(result);
            setSubmitting(false);
            return; // Rejected — don't complete yet
          }
        }
      }

      await onComplete(mandate.id, {
        report,
        imageDataUrl: capturedImage,
        aiVerdict: aiVerdict ? JSON.stringify(aiVerdict) : null,
      });

      // Reset local state
      setReport('');
      setCapturedImage(null);
      setVerdict(null);
      onActivate(null);
    } catch (e) {
      console.error('Completion error:', e);
      // If LLM unavailable, complete anyway — don't block offline use
      await onComplete(mandate.id, { report, imageDataUrl: capturedImage, aiVerdict: null });
      onActivate(null);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = {
    completed: 'bg-surface-container/40 border-outline/5 opacity-55',
    pending: isMaster
      ? 'bg-red-500/5 border-red-500/25'
      : 'bg-surface-container border-outline/10',
    failed: 'bg-red-950/20 border-red-900/30',
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        statusColors[mandate.status] || statusColors.pending
      } ${isActive ? 'ring-1 ring-primary/30' : ''}`}
    >
      {/* ── Card header ─────────────────────────────────────────── */}
      <div
        className={`p-4 flex items-start gap-3 ${isPending ? 'cursor-pointer' : ''}`}
        onClick={handleActivate}
      >
        {/* Status dot / check */}
        <div
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            mandate.status === 'completed'
              ? 'bg-green-500 border-green-500'
              : isActive
              ? 'border-primary bg-primary/10'
              : 'border-outline/40'
          }`}
          onClick={e => { e.stopPropagation(); handleActivate(); }}
        >
          {mandate.status === 'completed' && (
            <span className="material-symbols-outlined text-white text-[13px] leading-none">check</span>
          )}
          {isPending && isActive && (
            <span className="material-symbols-outlined text-primary text-[13px] leading-none">edit</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${
            mandate.status === 'completed' ? 'line-through text-on-surface-variant' : 'text-neutral-100'
          }`}>
            {mandate.title}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
              isMaster ? 'bg-red-500/20 text-red-400' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {isMaster ? '⚡ MASTER' : mandate.category}
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
              mandate.importance === 'High' ? 'bg-primary/20 text-primary' :
              mandate.importance === 'Medium' ? 'bg-neutral-700 text-neutral-400' :
              'bg-neutral-800 text-neutral-500'
            }`}>
              {mandate.importance}
            </span>
            {isPending && <CompletionTypeIcon type={completionType} />}
            {mandate.completedAt && (
              <span className="text-[9px] text-on-surface-variant font-mono">
                ✓ {new Date(mandate.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Show stored completion report if completed */}
          {mandate.status === 'completed' && mandate.completionReport && (
            <p className="text-[10px] text-neutral-600 font-mono mt-2 leading-relaxed line-clamp-2">
              "{mandate.completionReport}"
            </p>
          )}
        </div>

        <button
          onClick={e => { e.stopPropagation(); onDelete(mandate.id); }}
          className="text-on-surface-variant hover:text-red-400 transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      {/* ── Completion interface (inline expansion) ─────────────── */}
      {isActive && isPending && (
        <div className="border-t border-neutral-800/60 px-4 pb-5 pt-4 space-y-4 bg-neutral-950/60">

          {/* Rejection verdict from AI */}
          {verdict && !verdict.accepted && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 space-y-1">
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-500">Rejected by The Architect</p>
              <p className="text-xs text-red-300 font-mono leading-relaxed">{verdict.comment}</p>
              <p className="text-[9px] text-neutral-600 font-mono mt-1">Rewrite your report. Be honest.</p>
            </div>
          )}

          {completionType === 'visual' ? (
            <>
              <div className="space-y-1">
                <p className="text-[9px] font-mono uppercase tracking-widest text-violet-400">Visual Verification</p>
                <p className="text-[10px] text-neutral-500 font-mono leading-relaxed">
                  The camera opens live. You cannot submit a photo from your gallery. Face it.
                </p>
              </div>
              <LiveCameraVerifier
                autoStart={true}
                onCapture={setCapturedImage}
                onCancel={() => onActivate(null)}
              />
              {capturedImage && (
                <div className="space-y-2 pt-1">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
                    Add a written note (optional)
                  </p>
                  <textarea
                    rows={2}
                    value={report}
                    onChange={e => setReport(e.target.value)}
                    placeholder="Any additional context for the record..."
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-700 outline-none resize-none leading-relaxed transition-colors font-mono"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-[9px] font-mono uppercase tracking-widest text-sky-400">Written Report</p>
                <p className="text-[10px] text-neutral-500 font-mono leading-relaxed">
                  Account for yourself precisely. Vague or evasive reports will be rejected.
                </p>
              </div>
              <textarea
                autoFocus
                rows={5}
                value={report}
                onChange={e => setReport(e.target.value)}
                placeholder="Describe exactly what you did, when, and how. Be specific. Don't soften it."
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none resize-none leading-relaxed transition-colors"
              />
              <div className="flex justify-between items-center">
                <span className={`text-[9px] font-mono ${
                  report.trim().length < 15 ? 'text-neutral-700' : 'text-green-600'
                }`}>
                  {report.trim().length} chars {report.trim().length < 15 ? '(min 15)' : '✓'}
                </span>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { onActivate(null); setVerdict(null); }}
              className="flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Not yet
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-950 hover:opacity-90 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
            >
              {submitting ? 'Verifying...' : 'Submit Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Mandates() {
  const { mandates, stats, addMandate, completeMandate, deleteMandate } = useAppData();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [activeMandate, setActiveMandate] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Mandate');
  const [newImportance, setNewImportance] = useState('Medium');

  const handleActivate = useCallback((id) => setActiveMandate(id), []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addMandate({ title: newTitle.trim(), category: newCategory, importance: newImportance });
    setNewTitle('');
    setShowModal(false);
  };

  const filtered = (mandates || []).filter(m => {
    if (filter === 'pending') return m.status === 'pending';
    if (filter === 'completed') return m.status === 'completed';
    if (filter === 'penance') return m.category === 'Penance';
    return true;
  });

  const pendingCount = (mandates || []).filter(m => m.status === 'pending').length;
  const masterCount = (mandates || []).filter(m => m.issuedByMaster && m.status === 'pending').length;

  return (
    <div className="bg-background text-on-surface">
      <main className="px-4 py-6 max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="pt-4 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tighter">Active Mandates</h2>
            <p className="text-xs text-on-surface-variant mt-1 font-mono">
              {pendingCount} pending · {stats.completedMandates} completed
              {masterCount > 0 && <span className="text-red-400"> · {masterCount} from Master</span>}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-on-surface text-surface rounded-full text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity active:scale-95"
          >
            + Add
          </button>
        </div>

        {/* Compliance bar */}
        <div className="bg-surface-container rounded-2xl p-4 border border-outline/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Daily Submission Level</span>
            <span className="font-mono text-sm font-bold text-primary">{stats.compliancePercent}%</span>
          </div>
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${stats.compliancePercent}%` }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[['all', 'All'], ['pending', 'Pending'], ['penance', '⚡ Penance'], ['completed', 'Done']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                filter === key
                  ? 'bg-on-surface text-surface'
                  : 'bg-surface-container text-on-surface-variant border border-outline/10 hover:border-outline/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Hint when nothing active */}
        {pendingCount > 0 && !activeMandate && (
          <p className="text-[10px] font-mono text-neutral-700 text-center">
            Tap a mandate to open its completion interface.
          </p>
        )}

        {/* Mandate list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant font-mono text-xs">
              {filter === 'penance' ? 'No active penances. Behave yourself.' : 'No mandates here. Add a discipline.'}
            </div>
          ) : (
            filtered.map(m => (
              <MandateCard
                key={m.id}
                mandate={m}
                isActive={activeMandate === m.id}
                onActivate={handleActivate}
                onComplete={completeMandate}
                onDelete={deleteMandate}
              />
            ))
          )}
        </div>
      </main>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-background/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-surface-container border-t border-outline/20 rounded-t-[32px] p-6 pb-10 space-y-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-display font-bold">New Discipline</h3>
              <button onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-neutral-100 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="What must be done?"
                className="w-full bg-surface-container-low border border-outline/10 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1 block">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline/10 rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1 block">Importance</label>
                  <select
                    value={newImportance}
                    onChange={e => setNewImportance(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline/10 rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    {IMPORTANCE.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest border border-outline/20 hover:bg-on-surface/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-on-surface text-surface hover:opacity-90 transition-opacity"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
