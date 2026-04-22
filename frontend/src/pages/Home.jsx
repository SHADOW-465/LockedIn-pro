import React from 'react';
import GazeInspection from '../components/GazeInspection';
import HierarchySelector from '../components/HierarchySelector';
import { useAppData } from '../contexts/AppDataContext';
import { useHierarchy } from '../contexts/HierarchyContext';
import LockTimer from '../components/LockTimer';

function StatPill({ label, value, highlight }) {
  return (
    <div className={`flex flex-col items-center px-4 py-4 rounded-2xl ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container border border-outline/10'}`}>
      <span className={`font-mono text-2xl font-bold ${highlight ? 'text-primary' : 'text-neutral-100'}`}>{value}</span>
      <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mt-1 text-center">{label}</span>
    </div>
  );
}

export default function Home() {
  const { stats, statsLoading, mandates } = useAppData();
  const { level } = useHierarchy();

  const pendingCount = mandates.filter(m => m.status === 'pending').length;
  const integrityDisplay = statsLoading ? '...' : stats.integrity.toFixed(2);
  const integrityPercent = statsLoading ? 0 : Math.round(stats.integrity * 100);
  const integrityColor = stats.integrity >= 0.8 ? 'text-green-400' : stats.integrity >= 0.5 ? 'text-primary' : 'text-red-500';

  return (
    <main className="px-5 py-6 space-y-5 max-w-2xl mx-auto">

      {/* Page header */}
      <section className="flex flex-col gap-1 pt-2">
        <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em]">The Mandate</span>
        <h2 className="text-3xl font-display font-bold text-neutral-100 tracking-tighter">Integrity Check.</h2>
        <div className="mt-2 w-44">
          <HierarchySelector />
        </div>
      </section>

      {/* Live Lock Timer */}
      <LockTimer />

      {/* Integrity Factor */}
      <div className="bg-surface-container rounded-3xl p-6 border border-outline/10 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-on-surface-variant">Integrity Factor</p>
            <div className={`text-5xl font-mono font-bold mt-1 ${integrityColor}`}>{integrityDisplay}</div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {stats.compliancePercent}% daily compliance · {pendingCount} pending {pendingCount !== 1 ? 'mandates' : 'mandate'}
            </p>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${level.theme}`}>
            [{level.name}]
          </div>
        </div>
        {/* Integrity bar */}
        <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${stats.integrity >= 0.8 ? 'bg-green-500' : stats.integrity >= 0.5 ? 'bg-primary' : 'bg-red-500'}`}
            style={{ width: `${integrityPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatPill label="Day Streak" value={statsLoading ? '—' : stats.streak} highlight />
        <StatPill label="Inspections" value={statsLoading ? '—' : stats.totalGaze} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatPill label="Mandates Done" value={`${stats.completedMandates}/${stats.totalMandates}`} />
        <StatPill label="Journal Entries" value={statsLoading ? '—' : stats.journalCount} />
      </div>

      {/* Gaze Inspection */}
      <section>
        <GazeInspection />
      </section>

    </main>
  );
}
