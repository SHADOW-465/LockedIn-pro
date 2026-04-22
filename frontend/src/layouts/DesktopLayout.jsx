import React from 'react';
import { usePlatform } from '../contexts/PlatformContext';
import HierarchySelector from '../components/HierarchySelector';

const PAGE_TITLES = {
  home: 'The Gaze',
  mandates: 'Mandates',
  chronicle: 'Chronicle',
  chamber: 'Chamber',
  chat: 'The Summons',
};

const PAGE_SUBTITLES = {
  home: 'Integrity Dashboard',
  mandates: 'Active Directives',
  chronicle: 'Confessional Archive',
  chamber: 'Conditioning Protocol',
  chat: 'Direct Line to the Architect',
};

export default function DesktopLayout({ children, currentTab, setCurrentTab }) {
  const { isMobile } = usePlatform();

  if (isMobile) return null;

  const navItems = [
    { id: 'home',      icon: 'grid_view',    label: 'The Gaze'    },
    { id: 'mandates',  icon: 'task_alt',     label: 'Mandates'    },
    { id: 'chronicle', icon: 'auto_stories', label: 'Chronicle'   },
    { id: 'chamber',   icon: 'lock_person',  label: 'Chamber'     },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-neutral-950 border-r border-neutral-800/40 flex flex-col">

        {/* Brand */}
        <div className="px-6 pt-8 pb-6 border-b border-neutral-800/30">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-display text-[11px] font-bold tracking-[0.25em] text-neutral-500 uppercase">The Architect</span>
          </div>
          <h1 className="mt-2 font-display text-xl font-bold tracking-tighter text-neutral-100">
            LockedIn
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 pb-2 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200
                ${currentTab === id
                  ? 'bg-neutral-800/80 text-neutral-100 ring-1 ring-neutral-700/50'
                  : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900/60'
                }`}
            >
              <span className={`material-symbols-outlined text-[19px] flex-shrink-0 ${currentTab === id ? 'text-neutral-100' : ''}`}>{icon}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</span>
            </button>
          ))}

          {/* Divider */}
          <div className="pt-3 pb-1">
            <div className="h-px bg-neutral-800/40 mx-1" />
          </div>

          {/* The Summons — AI Chat */}
          <button
            onClick={() => setCurrentTab('chat')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200
              ${currentTab === 'chat'
                ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                : 'text-neutral-500 hover:text-primary/80 hover:bg-primary/5'
              }`}
          >
            <span className="material-symbols-outlined text-[19px] flex-shrink-0">psychology</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em]">The Summons</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
          </button>
        </nav>

        {/* Hierarchy + level badge */}
        <div className="px-3 py-4 border-t border-neutral-800/30">
          <HierarchySelector />
        </div>
      </aside>

      {/* ── Main Panel ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar — dynamic per page */}
        <header className="flex-shrink-0 h-14 flex items-center px-8 border-b border-neutral-800/40 bg-neutral-950/60 backdrop-blur-xl">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600">{PAGE_SUBTITLES[currentTab]}</span>
            <h2 className="font-display text-sm font-bold tracking-tighter text-neutral-100 uppercase mt-0.5">{PAGE_TITLES[currentTab]}</h2>
          </div>
        </header>

        {/* Content — The Summons gets its own scrolling context */}
        <main className={`flex-1 min-h-0 ${currentTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
