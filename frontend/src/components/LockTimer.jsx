import React, { useState, useEffect } from 'react';
import { AppState } from '../services/db/db';

function pad(n) { return String(n).padStart(2, '0'); }

function msToComponents(ms) {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const total = Math.floor(ms / 1000);
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

function TimeDisplay({ label, components, urgent = false }) {
  const { d, h, m, s } = components;
  return (
    <div>
      <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <div className={`font-mono text-2xl font-bold tabular-nums ${urgent ? 'text-primary animate-pulse' : 'text-neutral-100'}`}>
        {d > 0 ? `${d}d ` : ''}{pad(h)}:{pad(m)}:{pad(s)}
      </div>
    </div>
  );
}

/**
 * LockTimer — reads lockStartDate, targetLockDays, lockExtensionDays from AppState.
 * Ticks every second. Shows elapsed + remaining (if target set).
 * onSetDuration — called when user sets initial duration.
 */
export default function LockTimer({ onSetDuration }) {
  const [lockStart, setLockStart] = useState(null);
  const [targetDays, setTargetDays] = useState(null);
  const [extensionDays, setExtensionDays] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [settingDuration, setSettingDuration] = useState(false);
  const [draftDays, setDraftDays] = useState('');

  useEffect(() => {
    async function load() {
      const [start, target, ext] = await Promise.all([
        AppState.get('lockStartDate'),
        AppState.get('targetLockDays'),
        AppState.get('lockExtensionDays'),
      ]);
      setLockStart(start || null);
      setTargetDays(target ? Number(target) : null);
      setExtensionDays(ext ? Number(ext) : 0);
      setLoading(false);
    }
    load();
  }, []);

  // Re-read AppState every 30s to pick up changes made by AI actions
  useEffect(() => {
    const refresh = setInterval(async () => {
      const [target, ext] = await Promise.all([
        AppState.get('targetLockDays'),
        AppState.get('lockExtensionDays'),
      ]);
      setTargetDays(target ? Number(target) : null);
      setExtensionDays(ext ? Number(ext) : 0);
    }, 30000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleSetDuration = async () => {
    const days = parseInt(draftDays, 10);
    if (!days || days < 1) return;
    await AppState.set('targetLockDays', days);
    if (!lockStart) {
      const startDate = new Date().toISOString();
      await AppState.set('lockStartDate', startDate);
      setLockStart(startDate);
    }
    setTargetDays(days);
    setSettingDuration(false);
    setDraftDays('');
    onSetDuration?.();
  };

  if (loading) return null;

  if (!lockStart) {
    return (
      <div className="bg-surface-container rounded-3xl p-6 border border-outline/10 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-on-surface-variant">Lock Session</p>
        <p className="text-neutral-500 font-mono text-xs">No active lock. The Architect may initialize one, or set a target below.</p>
        <button
          onClick={() => setSettingDuration(true)}
          className="text-[10px] font-mono uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
        >
          + Set duration
        </button>
        {settingDuration && (
          <div className="flex gap-2 items-center pt-2">
            <input
              type="number"
              min="1"
              max="365"
              value={draftDays}
              onChange={e => setDraftDays(e.target.value)}
              placeholder="Days"
              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-mono text-neutral-200 outline-none focus:border-primary/50"
            />
            <button
              onClick={handleSetDuration}
              className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors"
            >
              Lock
            </button>
            <button
              onClick={() => setSettingDuration(false)}
              className="text-[10px] text-neutral-600 font-mono hover:text-neutral-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  const startMs = new Date(lockStart).getTime();
  const elapsedMs = now - startMs;
  const elapsed = msToComponents(elapsedMs);

  let remaining = null;
  let totalTargetDays = null;
  let isUrgent = false;
  if (targetDays !== null) {
    totalTargetDays = Math.max(0, targetDays + extensionDays);
    const totalTargetMs = totalTargetDays * 86400 * 1000;
    const remainingMs = totalTargetMs - elapsedMs;
    remaining = msToComponents(Math.max(0, remainingMs));
    isUrgent = remainingMs > 0 && remainingMs < 3600 * 1000;
  }

  return (
    <div className="bg-surface-container rounded-3xl p-6 border border-outline/10 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-on-surface-variant">Lock Session</p>
        <div className="flex items-center gap-2">
          {extensionDays > 0 && (
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-900/40">
              +{extensionDays}d added
            </span>
          )}
          {extensionDays < 0 && (
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-900/40">
              {extensionDays}d removed
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TimeDisplay label="Elapsed" components={elapsed} />
        {remaining !== null && (
          <TimeDisplay label="Remaining" components={remaining} urgent={isUrgent} />
        )}
      </div>

      {totalTargetDays !== null && (
        <div className="space-y-1">
          <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${Math.min(100, (elapsedMs / (totalTargetDays * 86400 * 1000)) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] font-mono text-neutral-600">
            Target: {totalTargetDays} day{totalTargetDays !== 1 ? 's' : ''}
            {extensionDays !== 0 ? ` (base ${targetDays}d ${extensionDays > 0 ? '+' : ''}${extensionDays}d)` : ''}
          </p>
        </div>
      )}

      {targetDays === null && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingDuration(true)}
            className="text-[10px] font-mono uppercase tracking-widest text-primary/50 hover:text-primary/80 transition-colors"
          >
            + Set target duration
          </button>
          {settingDuration && (
            <>
              <input
                type="number"
                min="1"
                max="365"
                value={draftDays}
                onChange={e => setDraftDays(e.target.value)}
                placeholder="Days"
                className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm font-mono text-neutral-200 outline-none focus:border-primary/50"
              />
              <button
                onClick={handleSetDuration}
                className="px-2 py-1 rounded-lg bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/30 transition-colors"
              >
                Set
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
