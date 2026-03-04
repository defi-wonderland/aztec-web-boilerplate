import React from 'react';
import { useAztecWallet, useConnectModal, WalletType } from '@aztec-wallet';
import { SecurityWarning } from '../../components';
import { DripperCard } from './DripperCard';

const styles = {
  wrapper:
    'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6',
} as const;

export const MintFeatureScreen: React.FC = () => {
  const {
    isConnected,
    isPXEInitialized,
    currentConfig,
    connector,
    walletType,
  } = useAztecWallet();
  const { open: openConnectModal } = useConnectModal();

  const showSecurityWarning = isConnected && walletType === WalletType.EMBEDDED;

  return (
    <div className={styles.wrapper}>
      {showSecurityWarning && <SecurityWarning />}
      <DripperCard
        isPXEInitialized={isPXEInitialized}
        isConnected={isConnected}
        currentConfig={currentConfig}
        connectorStatus={connector?.getStatus().status}
        onConnectClick={openConnectModal}
      />
    </div>
  );
};
