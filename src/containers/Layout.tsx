import React from 'react';
import { useAztecWallet } from '../aztec-wallet';
import { MainContent } from './MainContent';

const styles = {
  container: 'w-full',
} as const;

export const Layout: React.FC = () => {
  const { isPXEInitialized, isConnected } = useAztecWallet();

  if (!isConnected || !isPXEInitialized) {
    return null;
  }

  return (
    <div className={styles.container}>
      <MainContent />
    </div>
  );
};
