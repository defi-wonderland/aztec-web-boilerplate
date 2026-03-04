import React, { useState, useCallback, useMemo } from 'react';
import { FEATURES } from '../features';
import { AppNavigationContext } from './AppNavigationContext';
import type { TabType } from '../types';

interface AppNavigationProviderProps {
  children: React.ReactNode;
  defaultTab?: TabType | null;
}

export const AppNavigationProvider: React.FC<AppNavigationProviderProps> = ({
  children,
  defaultTab,
}) => {
  const fallbackTab = useMemo<TabType | null>(() => {
    return FEATURES[0]?.id ?? null;
  }, []);

  const [requestedTab, setRequestedTab] = useState<TabType | null>(
    defaultTab ?? fallbackTab
  );

  const activeTab = useMemo<TabType | null>(() => {
    if (
      requestedTab !== null &&
      FEATURES.some((feature) => feature.id === requestedTab)
    ) {
      return requestedTab;
    }

    return fallbackTab;
  }, [fallbackTab, requestedTab]);

  const setActiveTab = useCallback((tab: TabType) => {
    setRequestedTab(tab);
  }, []);

  return (
    <AppNavigationContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </AppNavigationContext.Provider>
  );
};
