import React, { useCallback } from 'react';
import { WalletGroupButton } from '../../shared';
import { useConnectModalContext } from '../context';

const styles = {
  container: 'flex flex-col gap-3 stagger-children',
  error:
    'text-sm text-red-500 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20',
} as const;

/**
 * Main view showing wallet group options
 */
export const MainView: React.FC = () => {
  const { config, setView, setConnectingState, onConnect, error, isLoading } =
    useConnectModalContext();

  const { walletGroups } = config;

  const handleEmbeddedClick = useCallback(async () => {
    if (isLoading) return;

    setConnectingState({
      walletId: 'embedded',
      walletName: 'Embedded Wallet',
      walletType: 'embedded',
    });
    setView('connecting');
    await onConnect('embedded', 'embedded');
  }, [setConnectingState, setView, onConnect, isLoading]);

  const handleAztecWalletsClick = useCallback(() => {
    if (isLoading) return;
    setView('aztec-wallets');
  }, [setView, isLoading]);

  const handleEvmWalletsClick = useCallback(() => {
    if (isLoading) return;
    setView('evm-wallets');
  }, [setView, isLoading]);

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}

      {walletGroups.embedded && (
        <WalletGroupButton
          label={walletGroups.embedded.label || 'Embedded Wallet'}
          tag="Beta"
          showArrow={false}
          onClick={handleEmbeddedClick}
          disabled={isLoading}
          data-testid="wallet-group-embedded"
        />
      )}

      {walletGroups.aztecWallets && (
        <WalletGroupButton
          label={walletGroups.aztecWallets.label || 'Aztec Wallet'}
          onClick={handleAztecWalletsClick}
          disabled={isLoading}
          data-testid="wallet-group-aztec"
        />
      )}

      {walletGroups.evmWallets && (
        <WalletGroupButton
          label={walletGroups.evmWallets.label || 'EVM Wallet'}
          onClick={handleEvmWalletsClick}
          disabled={isLoading}
          data-testid="wallet-group-evm"
        />
      )}
    </div>
  );
};
