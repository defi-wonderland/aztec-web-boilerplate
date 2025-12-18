import React from 'react';
import { useUniversalWallet } from '../hooks';
import { MainContent } from './MainContent';

export const Layout: React.FC = () => {
  const { isInitialized, isConnected } = useUniversalWallet();

  const showLayout = isConnected && isInitialized;

  if (!showLayout) {
    return null;
  }

  return (
    <div className="layout-container">
      <MainContent />
    </div>
  );
};
