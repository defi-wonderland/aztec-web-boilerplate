import React from 'react';
import { useAztecWallet, useUniversalWallet } from '../hooks';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

export const Layout: React.FC = () => {
  const { isInitialized } = useAztecWallet();
  const { isConnected, activeAccount } = useUniversalWallet();

  // Show layout only when any wallet is connected and app is initialized
  const showLayout = isConnected && !!activeAccount && isInitialized;

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
