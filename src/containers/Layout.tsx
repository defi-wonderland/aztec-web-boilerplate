import React from 'react';
import { useAztecWallet } from '../aztec-wallet';
import { MainContent } from './MainContent';

const styles = {
  container: 'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6',
} as const;

export const Layout: React.FC = () => {
  const { isPXEInitialized, isConnected } = useAztecWallet();

  const showLayout = isConnected && isPXEInitialized;

  if (!showLayout) {
    return null;
  }

  return (
    <div className={styles.container}>
      <MainContent />
    </div>
  );
};
