import React, { useEffect, useState } from 'react';

export default function BiometricsMockup({ isScanning }) {
  const [hrv, setHrv] = useState(65);
  const [heartRate, setHeartRate] = useState(72);

  // Mock fluctuation
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      setHrv(prev => Math.max(20, Math.min(100, prev + (Math.random() * 4 - 2))));
      setHeartRate(prev => Math.max(50, Math.min(120, prev + (Math.random() * 6 - 3))));
    }, 1500);
    return () => clearInterval(interval);
  }, [isScanning]);

  const hrvStatus = hrv < 40 ? 'text-error' : hrv > 70 ? 'text-secondary' : 'text-primary';

  return (
    <div className={`bg-surface-container-low p-md rounded-[24px] border ${isScanning ? 'border-secondary/50 shadow-[0_0_15px_rgba(192,193,255,0.2)]' : 'border-outline-variant/30'} flex flex-col gap-4 relative overflow-hidden transition-all duration-500`}>
      {/* Background graphic */}
      {isScanning && (
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/5 to-transparent animate-pulse pointer-events-none"></div>
      )}

      <div className="flex justify-between items-center z-10">
        <h3 className="font-title-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[18px]">monitor_heart</span>
          Biometric Sync
        </h3>
        <span className={`font-label-caps uppercase tracking-widest ${isScanning ? 'text-secondary' : 'text-outline'}`}>
          {isScanning ? 'ACTIVE' : 'IDLE'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 z-10">
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-outline uppercase text-[10px]">Heart Rate</span>
          <div className="font-mono text-2xl text-primary">{Math.round(heartRate)} <span className="text-sm text-on-surface-variant">BPM</span></div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-caps text-outline uppercase text-[10px]">HRV (Focus)</span>
          <div className={`font-mono text-2xl ${hrvStatus}`}>{Math.round(hrv)} <span className="text-sm text-on-surface-variant">ms</span></div>
        </div>
      </div>

      <div className="w-full bg-surface-container-highest h-1 rounded-full mt-2 relative overflow-hidden">
        {isScanning ? (
           <div 
             className="bg-secondary h-full rounded-full transition-all duration-300" 
             style={{ width: `${Math.max(0, Math.min(100, hrv))}%` }}
           ></div>
        ) : (
           <div className="bg-outline-variant/50 h-full w-full"></div>
        )}
      </div>
    </div>
  );
}
