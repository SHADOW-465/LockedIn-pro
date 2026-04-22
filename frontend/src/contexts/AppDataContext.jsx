import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { AppState } from '../services/db/db';
import { StatsService } from '../services/db/StatsService';
import { MandateService } from '../services/db/MandateService';
import { JournalService, GazeService } from '../services/db/JournalService';
import { MandateFeedbackService } from '../services/ai/MandateFeedbackService';
import { useHierarchy } from './HierarchyContext';

const AppDataContext = createContext(null);

export const AppDataProvider = ({ children }) => {
  const { updateLevel } = useHierarchy();
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

  const mandates = useLiveQuery(
    () => db.mandates.orderBy('createdAt').reverse().toArray(),
    [], []
  );

  const journalEntries = useLiveQuery(
    () => db.journal_entries.orderBy('createdAt').reverse().toArray(),
    [], []
  );

  const gazeSessions = useLiveQuery(
    () => db.gaze_sessions.orderBy('createdAt').reverse().toArray(),
    [], []
  );

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    const freshStats = await StatsService.getDashboardStats();
    setStats(freshStats);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [mandates, journalEntries, gazeSessions, refreshStats]);

  const setAppState = useCallback((key, value) => AppState.set(key, value), []);
  const getAppState = useCallback((key) => AppState.get(key), []);

  // Controllers object passed to AI actions that need to mutate state
  const getControllers = useCallback(() => ({
    updateLevel,
    setAppState,
    refreshStats,
  }), [updateLevel, setAppState, refreshStats]);

  const addMandate = useCallback(async (mandateData) => {
    await MandateService.add(mandateData);
  }, []);

  const completeMandate = useCallback(async (id, completionData) => {
    // Snapshot mandate before completing (needed for feedback prompt)
    const mandate = await db.mandates.get(id);
    await MandateService.complete(id, completionData);

    // Fire-and-forget: AI reviews the completion and injects chat message
    MandateFeedbackService.trigger(mandate, completionData, getControllers());
  }, [getControllers]);

  const deleteMandate = useCallback(async (id) => {
    await MandateService.delete(id);
  }, []);

  const issuePenance = useCallback(async (penanceData) => {
    await MandateService.issuePenance(penanceData);
  }, []);

  const addJournalEntry = useCallback(async (entryData) => {
    return JournalService.add(entryData);
  }, []);

  const recordGazeSession = useCallback(async (sessionData) => {
    return GazeService.add(sessionData);
  }, []);

  return (
    <AppDataContext.Provider value={{
      mandates: mandates || [],
      journalEntries: journalEntries || [],
      gazeSessions: gazeSessions || [],
      stats,
      statsLoading,
      refreshStats,
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
