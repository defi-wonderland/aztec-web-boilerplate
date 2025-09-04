import React from 'react';
import { useAztecWallet } from '../hooks';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

export const Layout: React.FC = () => {
  const { connectedAccount, isInitialized } = useAztecWallet();

  // Show layout only when account is connected and app is initialized
  const showLayout = !!connectedAccount && isInitialized;

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
