import React from 'react';
import { useArtifacts, useContractSetup, useUniversalWallet } from '../hooks';
import { MainContent } from './MainContent';

const styles = {
  container: 'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6',
} as const;

export const Layout: React.FC = () => {
  // Load artifacts first, then setup contract registry
  // This is maybe not the best place for this, but the other approach is to create a Provider wrapper that really doesnt have sense
  useArtifacts();
  useContractSetup();

  const { isInitialized, isConnected } = useUniversalWallet();

  const showLayout = isConnected && isInitialized;

  if (!showLayout) {
    return null;
  }

  return (
    <div className={styles.container}>
      <MainContent />
    </div>
  );
};
