import React, { useCallback, useMemo } from 'react';
import { useEvmWalletsAvailability } from '../../../hooks';
import { BackButton, WalletButton } from '../../shared';
import { useConnectModalContext } from '../context';

const styles = {
  container: 'flex flex-col',
  backButton: 'mb-3',
  description: 'text-sm text-muted mb-4',
  walletList: 'flex flex-col gap-2 stagger-children',
} as const;

/**
 * View showing available EVM wallets
 *
 * Uses EIP-6963 discovery to detect installed wallets.
 * Wallets that aren't installed are shown as disabled with "Not Installed" text.
 */
export const EVMWalletsView: React.FC = () => {
  const { config, goBack, setView, setConnectingState, onConnect, isLoading } =
    useConnectModalContext();

  const evmWallets = config.walletGroups.evmWallets;

  // Get wallet availability from EIP-6963 discovery
  const walletsForAvailability = useMemo(
    () => (evmWallets ? evmWallets.wallets : []),
    [evmWallets]
  );
  const walletAvailability = useEvmWalletsAvailability(walletsForAvailability);

  const handleWalletClick = useCallback(
    async (walletId: string, walletName: string, rdns?: string) => {
      if (isLoading) return;

      // Don't allow clicking if wallet is not installed
      if (rdns && !walletAvailability[rdns]) {
        return;
      }

      setConnectingState({
        walletId,
        walletName,
        walletType: 'evm',
      });
      setView('connecting');
      await onConnect(walletId, 'evm');
    },
    [setConnectingState, setView, onConnect, isLoading, walletAvailability]
  );

  if (!evmWallets) {
    return null;
  }

  return (
    <div className={styles.container}>
      <BackButton onClick={goBack} className={styles.backButton} />

      <p className={styles.description}>
        Connect using your existing Ethereum wallet. Your EVM account will be
        used to derive an Aztec-compatible address.
      </p>

      <div className={styles.walletList}>
        {evmWallets.wallets.map((wallet) => {
          const isInstalled = wallet.rdns
            ? walletAvailability[wallet.rdns]
            : undefined;

          return (
            <WalletButton
              key={wallet.id}
              name={wallet.name}
              icon={wallet.icon}
              isInstalled={isInstalled}
              onClick={() =>
                handleWalletClick(wallet.id, wallet.name, wallet.rdns)
              }
              disabled={isLoading}
              data-testid={`wallet-button-${wallet.id}`}
            />
          );
        })}
      </div>
    </div>
  );
};
