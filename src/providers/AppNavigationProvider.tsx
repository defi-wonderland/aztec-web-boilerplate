import React, { useState, useCallback } from 'react';
import { AppNavigationContext } from './AppNavigationContext';
import type { TabType } from '../types';

interface AppNavigationProviderProps {
  children: React.ReactNode;
  defaultTab?: TabType;
}

export const AppNavigationProvider: React.FC<AppNavigationProviderProps> = ({
  children,
  defaultTab = 'mint',
}) => {
  const [activeTab, setActiveTabState] = useState<TabType>(defaultTab);

  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabState(tab);
  }, []);

  return (
    <AppNavigationContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </AppNavigationContext.Provider>
  );
};
