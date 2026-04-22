import React from 'react';

export default function ModelLoadingOverlay({ progress }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⛓</div>
        <h2 style={{ color: '#c084fc', fontSize: '20px', fontWeight: 700, letterSpacing: '0.05em', margin: 0 }}>
          LockedIn Pro
        </h2>
        <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px' }}>
          Initializing The Architect…
        </p>
      </div>

      <div style={{ width: '260px' }}>
        <div style={{
          width: '100%', height: '4px',
          background: '#1f1f1f', borderRadius: '2px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <p style={{ color: '#4b5563', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
          {progress < 100 ? `Loading model… ${progress}%` : 'Ready'}
        </p>
      </div>
    </div>
  );
}
