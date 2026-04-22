import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * LiveCameraVerifier
 * Opens a live getUserMedia stream immediately (no static file picker).
 * Capture grabs a canvas frame from the live feed — cannot be faked with a photo.
 * Props:
 *   autoStart  — start camera immediately on mount (default true)
 *   onCapture  — called with (dataUrl) when user captures
 *   onCancel   — called when user cancels/closes
 */
export default function LiveCameraVerifier({ autoStart = true, onCapture, onCancel, instruction }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('starting'); // starting | live | captured | error
  const [captured, setCaptured] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setPhase('starting');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('live');
    } catch (e) {
      setPhase('error');
      setErrorMsg(
        e.name === 'NotAllowedError'
          ? 'Camera access denied. Refusal noted and recorded.'
          : 'Camera failed to initialise. Report this as a malfunction.'
      );
    }
  }, []);

  useEffect(() => {
    if (autoStart) startStream();
    return () => stopStream();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.82);
  }, []);

  // Countdown then auto-capture (anti-tamper: user must stay in frame)
  const startCountdown = useCallback(() => {
    let n = 3;
    setCountdown(n);
    const interval = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(interval);
        setCountdown(null);
        const dataUrl = captureFrame();
        if (dataUrl) {
          setCaptured(dataUrl);
          setPhase('captured');
          stopStream();
          onCapture?.(dataUrl);
        }
      } else {
        setCountdown(n);
      }
    }, 1000);
  }, [captureFrame, stopStream, onCapture]);

  const handleRetake = () => {
    setCaptured(null);
    startStream();
  };

  // ─── Error state ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="rounded-xl bg-red-950/30 border border-red-900/40 p-5 space-y-3 text-center">
        <span className="material-symbols-outlined text-red-500 text-3xl block">
          no_photography
        </span>
        <p className="text-red-400 font-mono text-xs leading-relaxed">{errorMsg}</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={startStream}
            className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Retreat
          </button>
        </div>
      </div>
    );
  }

  // ─── Captured state ────────────────────────────────────────────────────────
  if (phase === 'captured' && captured) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-green-900/50">
          <img
            src={captured}
            alt="Captured frame"
            className="w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute inset-0 bg-green-500/5 pointer-events-none" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[9px] font-mono text-green-400 uppercase tracking-widest">Captured</span>
          </div>
        </div>
        <p className="text-[10px] font-mono text-neutral-500 text-center">
          Frame locked. Submit your report to complete.
        </p>
        <button
          onClick={handleRetake}
          className="w-full py-2 rounded-xl text-[10px] font-mono text-neutral-500 border border-neutral-800 uppercase tracking-widest hover:text-neutral-300 transition-colors"
        >
          Retake
        </button>
      </div>
    );
  }

  // ─── Live feed ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Live video */}
      <div
        className="relative rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800"
        style={{ aspectRatio: '4/3' }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Starting overlay */}
        {phase === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950">
            <div className="flex gap-1">
              {[0, 150, 300].map(d => (
                <div
                  key={d}
                  className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
            <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
              Initialising lens...
            </p>
          </div>
        )}

        {/* Live badge */}
        {phase === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest">Live</span>
          </div>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-6xl font-display font-bold text-white tabular-nums">
              {countdown}
            </span>
          </div>
        )}

        {/* Scan line animation when live */}
        {phase === 'live' && countdown === null && (
          <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/40 animate-scan pointer-events-none" />
        )}
      </div>

      {/* Instruction */}
      <p className="text-[10px] font-mono text-neutral-500 leading-relaxed text-center px-2">
        {instruction || 'Face the lens directly. Do not look away. Press capture when ready — a 3-second countdown will fire.'}
      </p>

      {/* Capture button */}
      {phase === 'live' && countdown === null && (
        <button
          onClick={startCountdown}
          className="w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-950 hover:opacity-90 active:scale-95 transition-all"
        >
          Submit to The Gaze
        </button>
      )}

      {phase === 'live' && countdown !== null && (
        <div className="w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-neutral-800 text-neutral-400 text-center">
          Hold still...
        </div>
      )}
    </div>
  );
}
