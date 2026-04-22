import React, { useState, useEffect } from 'react';
import { SummaryCard, StatCard, VaultFileCard } from '../components/BentoCards';
import { BiometricService } from '../services/BiometricService';

export default function IndoctrinationChamber() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState([
    { id: 1, name: 'chastity_foundation.mp3', type: 'Audio', status: 'Synced', date: '2026-04-20' },
    { id: 2, name: 'submission_training_v1.txt', type: 'Transcript', status: 'In Library', date: '2026-04-21' },
  ]);

  useEffect(() => {
    const authenticateUser = async () => {
      const success = await BiometricService.authenticate("Face the Architect's Gaze to proceed.");
      setIsAuthenticated(success);
    };
    authenticateUser();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const newFile = {
      id: Date.now(),
      name: file.name,
      type: file.name.endsWith('.mp3') || file.name.endsWith('.wav') ? 'Audio' : 'Transcript',
      status: 'Processing',
      date: new Date().toISOString().split('T')[0]
    };
    
    setFiles([newFile, ...files]);
    
    // Simulate processing
    setTimeout(() => {
      setFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, status: 'Synced' } : f));
    }, 3000);
  };

  const deleteFile = (id) => {
    setFiles(files.filter(f => f.id !== id));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 bg-stripes-dark animate-in fade-in zoom-in-95 duration-500">
        <span className="material-symbols-outlined text-[80px] text-primary mb-6 animate-pulse drop-shadow-[0_0_15px_rgba(255,0,85,0.5)]">fingerprint</span>
        <h2 className="text-3xl font-display font-bold mb-3 tracking-tighter uppercase text-center">Chamber Locked</h2>
        <p className="text-on-surface-variant font-mono text-xs text-center max-w-sm mb-10 leading-relaxed">
          Access to the Indoctrination Chamber requires biometric submission. The Architect demands to see you.
        </p>
        <button 
          onClick={async () => {
            const success = await BiometricService.authenticate();
            setIsAuthenticated(success);
          }}
          className="px-8 py-4 bg-primary text-on-primary rounded-pill font-bold tracking-widest text-sm hover:opacity-90 transition-all hover:shadow-[0_0_20px_rgba(255,0,85,0.6)] active:scale-95"
        >
          SUBMIT FOR VERIFICATION
        </button>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface">
      <main className="px-5 py-6 max-w-2xl mx-auto space-y-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-8">
            <SummaryCard 
              title="Architect's Memory" 
              value="84% Mirroring" 
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <StatCard title="Chamber Files" value={files.length} trend="+1 today" />
          </div>
        </div>

        <section className="relative group">
          <input 
            type="file" 
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="bg-surface-container border-2 border-dashed border-outline/20 rounded-[40px] p-10 flex flex-col items-center justify-center text-center transition-all group-hover:border-primary/40 group-hover:bg-primary/5">
            <span className="material-symbols-outlined text-4xl mb-4 text-on-surface-variant group-hover:text-primary transition-colors">cloud_upload</span>
            <h3 className="font-display font-bold text-lg">Ingest New Training</h3>
            <p className="text-on-surface-variant text-sm mt-1">Upload audio affirmations or transcripts. The Architect will learn.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-display font-bold tracking-tight px-2">The Library</h2>
          <div className="grid grid-cols-1 gap-4">
            {files.map(file => (
               <VaultFileCard 
                 key={file.id}
                 {...file}
                 onDelete={() => deleteFile(file.id)}
               />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
