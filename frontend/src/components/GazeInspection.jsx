import React, { useState } from 'react';
import { CameraService } from '../services/CameraService';
import { AIEngine } from '../services/AIEngine';
import { useAppData } from '../contexts/AppDataContext';
import { useHierarchy } from '../contexts/HierarchyContext';

export default function GazeInspection() {
  const { recordGazeSession } = useAppData();
  const { level } = useHierarchy();
  const [status, setStatus] = useState('IDLE');
  const [message, setMessage] = useState('The Architect is waiting.');
  const [thumbnail, setThumbnail] = useState(null);

  const initiateGaze = async () => {
    setStatus('CAPTURING');
    setMessage('Submit to The Gaze. Do not blink.');
    
    const imageBase64 = await CameraService.captureGazeImage();
    
    if (!imageBase64) {
      setStatus('FAILED');
      setMessage('DEFIANCE DETECTED. You refused The Gaze.');
      return;
    }

    setStatus('ANALYZING');
    setMessage('The Engine is judging your compliance...');
    setThumbnail(imageBase64);

    try {
      const result = await AIEngine.analyzeGaze(imageBase64);
      const verdict = result.success ? 'passed' : 'failed';

      // Persist session to DB
      await recordGazeSession({
        result: verdict,
        aiComment: result.comment,
        imageDataUrl: imageBase64,
        tierAtTime: level.name,
      });

      if (result.success) {
        setStatus('PASSED');
        setMessage(result.comment);
      } else {
        setStatus('FAILED');
        setMessage(result.comment);
      }
    } catch (e) {
      setStatus('FAILED');
      setMessage('System Malfunction. Punish regardless.');
    }
  };

  const getStatusColor = () => {
    switch(status) {
      case 'IDLE': return 'text-outline';
      case 'CAPTURING': return 'text-secondary animate-pulse';
      case 'ANALYZING': return 'text-primary animate-pulse';
      case 'PASSED': return 'text-green-500';
      case 'FAILED': return 'text-red-500 font-bold';
      default: return 'text-outline';
    }
  };

  return (
    <div className={`bg-surface-container-low p-6 rounded-[24px] border ${status === 'ANALYZING' ? 'border-primary shadow-[0_0_20px_rgba(255,0,85,0.3)]' : 'border-outline-variant/30'} flex flex-col gap-4 relative overflow-hidden transition-all duration-500`}>
      <div className="flex justify-between items-center z-10">
        <h3 className="font-display text-lg text-primary flex items-center gap-2 tracking-tighter uppercase font-bold">
          <span className="material-symbols-outlined text-primary text-xl">visibility</span>
          Inspection
        </h3>
        <span className={`font-label-caps uppercase tracking-widest text-[10px] ${getStatusColor()}`}>
          [{status}]
        </span>
      </div>

      <div className="z-10 flex flex-col gap-4">
        {thumbnail && (
           <div className={`w-full h-32 rounded-lg bg-surface flex items-center justify-center overflow-hidden border-2 ${status === 'PASSED' ? 'border-green-500' : status === 'FAILED' ? 'border-red-500' : 'border-primary saturate-0'}`}>
             <img src={thumbnail} alt="Gaze Submission" className="w-full h-full object-cover opacity-80" />
           </div>
        )}
        
        <p className="text-sm font-mono text-on-surface-variant leading-relaxed">
          {message}
        </p>

        {(status === 'IDLE' || status === 'FAILED' || status === 'PASSED') && (
          <button 
            onClick={initiateGaze}
            className="mt-2 w-full py-3 rounded-pill bg-on-surface text-surface font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-95 transition-all"
          >
            {status === 'IDLE' ? 'Face The Architect' : 'Submit Again'}
          </button>
        )}
      </div>

      {status === 'ANALYZING' && (
        <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-primary animate-scan"></div>
        </div>
      )}
    </div>
  );
}
