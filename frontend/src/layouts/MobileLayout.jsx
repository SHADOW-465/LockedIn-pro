import React from 'react';
import BottomNavBar from '../components/BottomNavBar';
import TopAppBar from '../components/TopAppBar';
import { usePlatform } from '../contexts/PlatformContext';

export default function MobileLayout({ children, currentTab, setCurrentTab }) {
  const { isMobile } = usePlatform();

  if (!isMobile) return null;

  const isChatPage = currentTab === 'chat';

  return (
    <div className="flex flex-col h-full">
      <TopAppBar currentTab={currentTab} />
      <div className={`flex-1 min-h-0 ${isChatPage ? 'overflow-hidden pt-14' : 'overflow-y-auto pt-14 pb-20'}`}>
        {children}
      </div>
      <BottomNavBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}
