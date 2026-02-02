import React, { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAztecWalletContext } from '../../providers/context';
import { useModalStore } from '../../store/modal';
import { useNetworkStore } from '../../store/network';
import { useWalletStore } from '../../store/wallet';
import { AccountModal } from '../AccountModal';
import { ConnectModal } from '../ConnectModal';
import { NetworkModal } from '../NetworkModal';
import type { ModalWalletType } from '../../types';

/**
 * Internal component that renders all AztecWallet modals
 *
 * This component is automatically rendered inside AztecWalletProvider.
 * Users don't need to render modals manually.
 */
export const AztecWalletModals: React.FC = () => {
  const { config } = useAztecWalletContext();

  // Modal state
  const { openModal, closeModal, setModal } = useModalStore(
    useShallow((state) => ({
      openModal: state.openModal,
      closeModal: state.closeModal,
      setModal: state.setModal,
    }))
  );

  // Wallet state
  const walletState = useWalletStore(
    useShallow((state) => ({
      account: state.account,
      status: state.status,
      connect: state.connect,
      connectEmbedded: state.connectEmbedded,
      connectExistingEmbedded: state.connectExistingEmbedded,
      hasSavedEmbeddedAccount: state.hasSavedEmbeddedAccount,
      disconnect: state.disconnect,
      connectors: state.connectors,
    }))
  );

  // Network state
  const currentConfig = useNetworkStore((state) => state.currentConfig);

  const isConnected = walletState.status === 'connected';
  const address = walletState.account?.getAddress().toString() ?? '';

  // Handle connect modal open change
  const handleConnectOpenChange = useCallback(
    (open: boolean) => {
      setModal(open ? 'connect' : null);
    },
    [setModal]
  );

  // Handle account modal open change
  const handleAccountOpenChange = useCallback(
    (open: boolean) => {
      setModal(open ? 'account' : null);
    },
    [setModal]
  );

  // Handle network modal open change
  const handleNetworkOpenChange = useCallback(
    (open: boolean) => {
      setModal(open ? 'network' : null);
    },
    [setModal]
  );

  // Handle wallet connection from modal
  const handleConnect = useCallback(
    async (walletId: string, walletType: ModalWalletType) => {
      // Use the appropriate connection method based on wallet type
      if (walletType === 'embedded') {
        if (walletState.hasSavedEmbeddedAccount()) {
          await walletState.connectExistingEmbedded(walletId);
        } else {
          await walletState.connectEmbedded(walletId);
        }
      } else {
        await walletState.connect(walletId);
      }

      closeModal();
    },
    [walletState, closeModal]
  );

  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    await walletState.disconnect();
    closeModal();
  }, [walletState, closeModal]);

  return (
    <>
      {/* Connect Modal */}
      <ConnectModal
        open={openModal === 'connect'}
        onOpenChange={handleConnectOpenChange}
        config={config}
        onConnect={handleConnect}
      />

      {/* Account Modal */}
      {isConnected && address && (
        <AccountModal
          open={openModal === 'account'}
          onOpenChange={handleAccountOpenChange}
          address={address}
          networkName={currentConfig?.name}
          showNetwork={config.accountModal?.showNetwork}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* Network Modal */}
      <NetworkModal
        open={openModal === 'network'}
        onOpenChange={handleNetworkOpenChange}
        networks={config.networks}
      />
    </>
  );
};
