import React from 'react';
import { useUniversalWallet } from '../hooks';
import { MainContent } from './MainContent';
import { ClearSigningDemo } from '../components';

export const Layout: React.FC = () => {
  const { isInitialized, isConnected } = useUniversalWallet();

  const showLayout = isConnected && isInitialized;

  // Show ClearSigningDemo on landing page when not connected
  // This allows E2E tests to access the MetaMask flow directly
  if (!showLayout) {
    return (
      <div className="layout-container">
        <ClearSigningDemo />
      </div>
    );
  }

  return (
    <div className="layout-container">
      <MainContent />
    </div>
  );
};
