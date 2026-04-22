import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Chronicle from './pages/Chronicle';
import Mandates from './pages/Mandates';
import IndoctrinationChamber from './pages/IndoctrinationChamber';
import MasterChat from './pages/MasterChat';
import OnboardingChat from './pages/OnboardingChat';
import { PlatformProvider } from './contexts/PlatformContext';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { AppDataProvider } from './contexts/AppDataContext';
import { OnboardingService } from './services/db/OnboardingService';
import MobileLayout from './layouts/MobileLayout';
import DesktopLayout from './layouts/DesktopLayout';
import ModelLoadingOverlay from './components/ModelLoadingOverlay';
import { UnifiedAIEngine } from './services/UnifiedAIEngine';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('home');
  const [onboardingComplete, setOnboardingComplete] = useState(null);
  const [modelProgress, setModelProgress] = useState(null); // null = not needed

  useEffect(() => {
    OnboardingService.isComplete().then(done => setOnboardingComplete(done));

    // On Android (Capacitor), pre-load wllama model
    UnifiedAIEngine.detectEnvironment().then(() => {
      if (UnifiedAIEngine.usesWllama()) {
        setModelProgress(0);
        UnifiedAIEngine.loadWllama(p => setModelProgress(p))
          .then(() => setModelProgress(100))
          .catch(() => setModelProgress(100)); // show app even if load fails
      }
    });
  }, []);

  const handleOnboardingDone = () => setOnboardingComplete(true);

  // Show model loading overlay on Android until model is ready
  if (modelProgress !== null && modelProgress < 100) {
    return <ModelLoadingOverlay progress={modelProgress} />;
  }

  // Loading check
  if (onboardingComplete === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Establishing Connection</p>
        </div>
      </div>
    );
  }

  // Show onboarding if not complete
  if (!onboardingComplete) {
    return <OnboardingChat onComplete={handleOnboardingDone} />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'home': return <Home />;
      case 'mandates': return <Mandates />;
      case 'chronicle': return <Chronicle />;
      case 'chamber': return <IndoctrinationChamber />;
      case 'chat': return <MasterChat />;
      default: return <Home />;
    }
  };

  return (
    <div className="w-full h-full bg-background text-neutral-100 font-sans">
      <MobileLayout currentTab={currentTab} setCurrentTab={setCurrentTab}>
        {renderContent()}
      </MobileLayout>
      <DesktopLayout currentTab={currentTab} setCurrentTab={setCurrentTab}>
        {renderContent()}
      </DesktopLayout>
    </div>
  );
}

function App() {
  return (
    <PlatformProvider>
      <HierarchyProvider>
        <AppDataProvider>
          <AppContent />
        </AppDataProvider>
      </HierarchyProvider>
    </PlatformProvider>
  );
}

export default App;
