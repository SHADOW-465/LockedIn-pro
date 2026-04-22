import React from 'react';
import { usePlatform } from '../contexts/PlatformContext';

const PAGE_TITLES = {
  home: 'The Gaze',
  mandates: 'Mandates',
  chronicle: 'Chronicle',
  chamber: 'Chamber',
  chat: 'The Summons',
};

export default function TopAppBar({ currentTab }) {
  const title = PAGE_TITLES[currentTab] || 'LockedIn';

  return (
    <header className="bg-neutral-950/90 backdrop-blur-2xl text-neutral-100 fixed top-0 left-0 right-0 z-50 border-b border-neutral-800/40 md:hidden">
      <div className="flex justify-between items-center px-5 h-14 w-full">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-300 font-bold">{title}</span>
        </div>
        <span className="font-display text-[13px] font-bold tracking-tighter text-neutral-500 uppercase">The Architect</span>
      </div>
    </header>
  );
}
