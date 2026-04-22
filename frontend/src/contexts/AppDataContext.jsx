import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { AppState } from '../services/db/db';
import { StatsService } from '../services/db/StatsService';
import { MandateService } from '../services/db/MandateService';
import { JournalService, GazeService } from '../services/db/JournalService';

const AppDataContext = createContext(null);

export const AppDataProvider = ({ children }) => {
  const [stats, setStats] = useState({
    streak: 0,
    integrity: 1.0,
    daysLocked: 0,
    compliancePercent: 0,
    totalMandates: 0,
    completedMandates: 0,
    totalGaze: 0,
    passedGaze: 0,
    journalCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // --- Live Mandate Query (auto-updates UI on any change) ---
  const mandates = useLiveQuery(
    () => db.mandates.orderBy('createdAt').reverse().toArray(),
    [],
    []
  );

  // --- Live Journal Query ---
  const journalEntries = useLiveQuery(
    () => db.journal_entries.orderBy('createdAt').reverse().toArray(),
    [],
    []
  );

  // --- Live Gaze Sessions ---
  const gazeSessions = useLiveQuery(
    () => db.gaze_sessions.orderBy('createdAt').reverse().toArray(),
    [],
    []
  );

  // --- Recalculate all stats whenever any live data changes ---
  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    const freshStats = await StatsService.getDashboardStats();
    setStats(freshStats);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [mandates, journalEntries, gazeSessions, refreshStats]);

  // --- Mandate Actions ---
  const addMandate = useCallback(async (mandateData) => {
    await MandateService.add(mandateData);
    // useLiveQuery will auto-refresh mandates; stats will cascade
  }, []);

  const completeMandate = useCallback(async (id, completionData) => {
    await MandateService.complete(id, completionData);
  }, []);

  const deleteMandate = useCallback(async (id) => {
    await MandateService.delete(id);
  }, []);

  const issuePenance = useCallback(async (penanceData) => {
    await MandateService.issuePenance(penanceData);
  }, []);

  // --- Journal Actions ---
  const addJournalEntry = useCallback(async (entryData) => {
    const id = await JournalService.add(entryData);
    return id;
  }, []);

  // --- Gaze Actions ---
  const recordGazeSession = useCallback(async (sessionData) => {
    const id = await GazeService.add(sessionData);
    return id;
  }, []);

  // --- AppState helpers ---
  const getAppState = useCallback((key) => AppState.get(key), []);
  const setAppState = useCallback((key, value) => AppState.set(key, value), []);

  return (
    <AppDataContext.Provider value={{
      // Live data
      mandates: mandates || [],
      journalEntries: journalEntries || [],
      gazeSessions: gazeSessions || [],

      // Computed stats
      stats,
      statsLoading,
      refreshStats,

      // Actions
      addMandate,
      completeMandate,
      deleteMandate,
      issuePenance,
      addJournalEntry,
      recordGazeSession,
      getAppState,
      setAppState,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
};
