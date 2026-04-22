import React, { createContext, useContext, useState, useEffect } from 'react';

const PlatformContext = createContext();

export const PlatformProvider = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Simple breakpoint check for Mobile / Desktop
    const checkPlatform = () => {
      // 768px is the typical tablet/mobile breakpoint
      setIsMobile(window.innerWidth < 768);
    };

    checkPlatform();
    window.addEventListener('resize', checkPlatform);

    return () => window.removeEventListener('resize', checkPlatform);
  }, []);

  return (
    <PlatformContext.Provider value={{ isMobile }}>
      {children}
    </PlatformContext.Provider>
  );
};

export const usePlatform = () => useContext(PlatformContext);
