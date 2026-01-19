import React, { useCallback, useMemo } from 'react';
import { useAztecWalletsAvailability } from '../../../hooks';
import { BackButton, WalletButton } from '../../shared';
import { useConnectModalContext } from '../context';

const styles = {
  container: 'flex flex-col',
  backButton: 'mb-3',
  description: 'text-sm text-muted mb-4',
  walletList: 'flex flex-col gap-2 stagger-children',
} as const;

/**
 * View showing available Aztec browser wallets
 *
 * Uses checkInstalled functions to detect installed wallets.
 * Wallets that aren't installed are shown as disabled with "Not Installed" text.
 */
export const AztecWalletsView: React.FC = () => {
  const { config, goBack, setView, setConnectingState, onConnect, isLoading } =
    useConnectModalContext();

  const aztecWallets = config.walletGroups.aztecWallets;

  // Get wallet availability from checkInstalled functions
  const walletsForAvailability = useMemo(
    () => (aztecWallets ? aztecWallets.wallets : []),
    [aztecWallets]
  );
  const walletAvailability = useAztecWalletsAvailability(
    walletsForAvailability
  );

  const handleWalletClick = useCallback(
    async (walletId: string, walletName: string) => {
      if (isLoading) return;

      // Don't allow clicking if wallet is not installed
      if (walletAvailability[walletId] === false) {
        return;
      }

      setConnectingState({
        walletId,
        walletName,
        walletType: 'aztec',
      });
      setView('connecting');
      await onConnect(walletId, 'aztec');
    },
    [setConnectingState, setView, onConnect, isLoading, walletAvailability]
  );

  if (!aztecWallets) {
    return null;
  }

  return (
    <div className={styles.container}>
      <BackButton onClick={goBack} className={styles.backButton} />

      <p className={styles.description}>
        Connect with a native Aztec wallet for the best experience. These
        wallets are built specifically for the Aztec network.
      </p>

      <div className={styles.walletList}>
        {aztecWallets.wallets.map((wallet) => {
          const isInstalled = walletAvailability[wallet.id];

          return (
            <WalletButton
              key={wallet.id}
              name={wallet.name}
              icon={wallet.icon}
              isInstalled={isInstalled}
              onClick={() => handleWalletClick(wallet.id, wallet.name)}
              disabled={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
};
