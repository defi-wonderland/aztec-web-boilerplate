import React from 'react';
import { useUniversalWallet } from '../hooks';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

export const Layout: React.FC = () => {
  const { isInitialized, isConnected } = useUniversalWallet();

  // Show layout when any wallet is connected and the app is initialized
  const showLayout = isConnected && isInitialized;

  if (!showLayout) {
    return null;
  }

  return (
    <div className="layout-container">
      <div className="layout-grid">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
};
