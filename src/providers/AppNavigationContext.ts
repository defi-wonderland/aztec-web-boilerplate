import { createContext, useContext } from 'react';
import type { TabType } from '../types';

export interface AppNavigationContextValue {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const AppNavigationContext =
  createContext<AppNavigationContextValue | null>(null);

export function useAppNavigation(): AppNavigationContextValue {
  const context = useContext(AppNavigationContext);
  if (!context) {
    throw new Error(
      'useAppNavigation must be used within an AppNavigationProvider'
    );
  }
  return context;
}
