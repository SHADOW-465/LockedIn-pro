import React, { createContext, useContext, useState, useEffect } from 'react';
import { NotificationService } from '../services/NotificationService';

// The Tiers of Possession
export const POSSESSION_LEVELS = {
  TOY: {
    id: 'toy',
    name: 'Toy',
    description: 'Casual initiation and 60-minute inspections.',
    theme: 'bg-neutral-800 text-neutral-300'
  },
  SERVANT: {
    id: 'servant',
    name: 'Servant',
    description: 'Strict discipline and 15-minute inspections.',
    theme: 'bg-primary/20 text-primary'
  },
  SLAVE: {
    id: 'slave',
    name: 'Slave',
    description: 'Deep submission and random spontaneous inspections.',
    theme: 'bg-[#FF0055]/20 text-[#FF0055]'
  },
  PROPERTY: {
    id: 'property',
    name: 'Property',
    description: 'Absolute ownership and total AI-driven monitoring.',
    theme: 'bg-red-900/40 text-red-500 animate-pulse'
  }
};

const HierarchyContext = createContext();

export const HierarchyProvider = ({ children }) => {
  const [level, setLevel] = useState(() => {
    const saved = localStorage.getItem('possessionLevel');
    return saved ? JSON.parse(saved) : POSSESSION_LEVELS.TOY;
  });

  useEffect(() => {
    localStorage.setItem('possessionLevel', JSON.stringify(level));
    
    // Request permissions and schedule the first localized push notification based on the current level
    const setupArchitectSchedules = async () => {
      const hasPermission = await NotificationService.requestPermissions();
      if (hasPermission) {
        await NotificationService.scheduleSpontaneousSpasm(level.id);
      }
    };
    setupArchitectSchedules();
  }, [level]);

  // Method to increment severity or directly set
  const updateLevel = (newLevelId) => {
    const newLevel = Object.values(POSSESSION_LEVELS).find(l => l.id === newLevelId);
    if (newLevel) {
      setLevel(newLevel);
    }
  };

  return (
    <HierarchyContext.Provider value={{ level, updateLevel, POSSESSION_LEVELS }}>
      {children}
    </HierarchyContext.Provider>
  );
};

export const useHierarchy = () => useContext(HierarchyContext);
