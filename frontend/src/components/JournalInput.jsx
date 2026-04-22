import React, { useState } from 'react';

export default function JournalInput() {
  const [entry, setEntry] = useState('');
  const [isWarning, setIsWarning] = useState(false);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setEntry(text);
    
    // Simulate the Architect's visual feedback on defiant words
    const defiantWords = ['quit', 'stop', 'tired', 'giving up', 'cheat'];
    const hasDefiance = defiantWords.some(word => text.toLowerCase().includes(word));
    setIsWarning(hasDefiance);
  };

  return (
    <div className={`bg-surface-container-low p-md rounded-[32px] border transition-colors duration-300 ${isWarning ? 'border-error shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'border-outline-variant/30'}`}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-title-sm text-primary">The Protocol Journal</h3>
          <span className={`font-mono text-xs ${isWarning ? 'text-error animate-pulse' : 'text-on-surface-variant'}`}>
            {isWarning ? 'UNACCEPTABLE_THOUGHT_DETECTED' : 'AWAITING_INPUT'}
          </span>
        </div>
        
        <textarea
          value={entry}
          onChange={handleTextChange}
          placeholder="Reflect on the state of the lock..."
          className="w-full bg-surface-container/50 text-on-surface placeholder:text-outline-variant/50 rounded-xl p-4 min-h-[150px] font-body-rt border-none focus:ring-1 focus:ring-secondary/50 resize-none no-scrollbar"
        ></textarea>

        <div className="flex justify-between items-center pt-2">
          <span className="font-label-caps text-outline uppercase tracking-widest">
            {entry.length} CHARACTERS
          </span>
          <button className="bg-primary text-on-primary hover:bg-primary-fixed disabled:opacity-50 disabled:cursor-not-allowed font-label-caps uppercase tracking-widest px-8 py-3 rounded-full transition-all active:scale-95 shadow-sm font-bold" disabled={entry.length === 0}>
            Submit to Architect
          </button>
        </div>
      </div>
    </div>
  );
}
