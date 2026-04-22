import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { SummaryCard, StatCard, VaultFileCard } from '../components/BentoCards';
import { BiometricService } from '../services/BiometricService';
import { DocumentService } from '../services/db/DocumentService';

export default function IndoctrinationChamber() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Live query — auto-updates when any document is added/deleted
  const files = useLiveQuery(
    () => DocumentService.getAll(),
    [],
    []
  );

  const handleAuth = async () => {
    const success = await BiometricService.authenticate("Face the Architect's Gaze to proceed.");
    setIsAuthenticated(success);
  };

  // Authenticate on mount
  React.useEffect(() => { handleAuth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || uploading) return;
    e.target.value = '';
    setUploading(true);

    const isAudio = /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
    const isText = /\.(txt|md|pdf|doc|docx)$/i.test(file.name);
    const type = isAudio ? 'Audio' : 'Transcript';

    // For text files: read content for RAG. For audio: store metadata only.
    let content = '';
    if (isText) {
      try {
        content = await file.text();
      } catch {
        content = '';
      }
    }

    await DocumentService.add({ name: file.name, type, content, status: 'Synced' });
    setUploading(false);
  };

  const deleteFile = async (id) => {
    await DocumentService.delete(id);
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
          onClick={handleAuth}
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
              value={`${files.length} Document${files.length !== 1 ? 's' : ''} Ingested`}
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <StatCard title="Chamber Files" value={files.length} trend="Persisted" />
          </div>
        </div>

        <section className="relative group">
          <input
            type="file"
            accept=".txt,.md,.pdf,.doc,.docx,.mp3,.wav,.ogg,.m4a"
            onChange={handleFileUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
          />
          <div className={`bg-surface-container border-2 border-dashed rounded-[40px] p-10 flex flex-col items-center justify-center text-center transition-all ${uploading ? 'border-primary/60 bg-primary/5' : 'border-outline/20 group-hover:border-primary/40 group-hover:bg-primary/5'}`}>
            <span className="material-symbols-outlined text-4xl mb-4 text-on-surface-variant group-hover:text-primary transition-colors">
              {uploading ? 'hourglass_top' : 'cloud_upload'}
            </span>
            <h3 className="font-display font-bold text-lg">
              {uploading ? 'Ingesting...' : 'Ingest New Training'}
            </h3>
            <p className="text-on-surface-variant text-sm mt-1">
              Upload text documents (.txt, .md) or audio affirmations (.mp3, .wav). Text files are indexed for the Architect's memory.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-display font-bold tracking-tight px-2">The Library</h2>
          {files.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant font-mono text-xs">
              The chamber is empty. Upload training materials to shape the Architect's understanding.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {files.map(file => (
                <VaultFileCard
                  key={file.id}
                  {...file}
                  date={new Date(file.uploadedAt).toISOString().split('T')[0]}
                  onDelete={() => deleteFile(file.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
