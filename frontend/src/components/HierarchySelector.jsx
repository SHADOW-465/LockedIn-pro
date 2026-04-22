import React, { useState } from 'react';
import { useHierarchy } from '../contexts/HierarchyContext';

export default function HierarchySelector() {
  const { level, updateLevel, POSSESSION_LEVELS } = useHierarchy();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex flex-col items-start px-3 py-2 rounded-lg border border-outline/10 text-left transition-all w-full ${level.theme}`}
      >
        <span className="text-[10px] font-mono tracking-widest uppercase opacity-70 mb-0.5">CURRENT LEVEL</span>
        <span className="font-label-caps uppercase tracking-widest font-bold text-sm">[{level.name}]</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface-container border border-outline/20 rounded-xl shadow-glass overflow-hidden z-[200]">
          <div className="p-3 border-b border-outline/10 bg-surface-container-low">
            <h4 className="font-display text-sm font-bold text-on-surface">Possession Settings</h4>
            <p className="text-[10px] text-on-surface-variant font-mono mt-1">Adjust Architect's intensity</p>
          </div>
          <div className="flex flex-col divide-y divide-outline/10">
            {Object.values(POSSESSION_LEVELS).map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => {
                  updateLevel(lvl.id);
                  setIsOpen(false);
                }}
                className={`p-3 text-left transition-all hover:bg-on-surface/5 flex justify-between items-center ${level.id === lvl.id ? 'bg-on-surface/10' : ''}`}
              >
                <div>
                  <div className={`font-label-caps uppercase text-xs font-bold tracking-wider ${lvl.theme.split(' ')[1]}`}>
                    [{lvl.name}]
                  </div>
                  <div className="text-[10px] text-on-surface-variant mt-1 leading-tight">{lvl.description}</div>
                </div>
                {level.id === lvl.id && <span className="material-symbols-outlined text-sm text-on-surface">radio_button_checked</span>}
                {level.id !== lvl.id && <span className="material-symbols-outlined text-sm text-on-surface-variant opacity-50">radio_button_unchecked</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
