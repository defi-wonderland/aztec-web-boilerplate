import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from '../../../components/ui';
import { ConnectModalProvider, useConnectModalContext } from './context';
import {
  MainView,
  AztecWalletsView,
  EVMWalletsView,
  ConnectingView,
  SuccessView,
} from './views';
import type { ResolvedAztecWalletConfig, ModalWalletType } from '../../types';

const styles = {
  content: 'sm:max-w-md',
  header: 'mb-4',
} as const;

/**
 * Internal modal content that switches between views
 */
const ModalContent: React.FC = () => {
  const { view, config } = useConnectModalContext();

  // Render view-specific header
  const renderHeader = () => {
    switch (view) {
      case 'main':
        return (
          <DialogHeader className={styles.header}>
            <DialogTitle>{config.modal?.title || 'Connect Wallet'}</DialogTitle>
            <DialogDescription>
              {config.modal?.subtitle ||
                'Choose how you want to connect. Each option offers a different balance of convenience and security.'}
            </DialogDescription>
          </DialogHeader>
        );
      case 'aztec-wallets':
        // Visually hidden title for accessibility
        return (
          <VisuallyHidden>
            <DialogTitle>Select Aztec Wallet</DialogTitle>
          </VisuallyHidden>
        );
      case 'evm-wallets':
        // Visually hidden title for accessibility
        return (
          <VisuallyHidden>
            <DialogTitle>Select EVM Wallet</DialogTitle>
          </VisuallyHidden>
        );
      case 'connecting':
        // Visually hidden title for accessibility
        return (
          <VisuallyHidden>
            <DialogTitle>Connecting Wallet</DialogTitle>
          </VisuallyHidden>
        );
      case 'success':
        // Visually hidden title for accessibility
        return (
          <VisuallyHidden>
            <DialogTitle>Connection Successful</DialogTitle>
          </VisuallyHidden>
        );
      default:
        return (
          <VisuallyHidden>
            <DialogTitle>Connect Wallet</DialogTitle>
          </VisuallyHidden>
        );
    }
  };

  // Render view content
  const renderView = () => {
    switch (view) {
      case 'main':
        return <MainView />;
      case 'aztec-wallets':
        return <AztecWalletsView />;
      case 'evm-wallets':
        return <EVMWalletsView />;
      case 'connecting':
        return <ConnectingView />;
      case 'success':
        return <SuccessView />;
      default:
        return <MainView />;
    }
  };

  return (
    <>
      {renderHeader()}
      {renderView()}
    </>
  );
};

export interface ConnectModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Resolved AztecWallet configuration */
  config: ResolvedAztecWalletConfig;
  /** Callback to handle wallet connection */
  onConnect: (walletId: string, walletType: ModalWalletType) => Promise<void>;
}

/**
 * Connect wallet modal component
 *
 * Provides a multi-step flow for connecting different wallet types:
 * - Embedded wallet (app-managed)
 * - Aztec browser wallets (Azguard, etc.)
 * - EVM wallets (MetaMask, Rabby, etc.)
 */
export const ConnectModal: React.FC<ConnectModalProps> = ({
  open,
  onOpenChange,
  config,
  onConnect,
}) => {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={styles.content}
        aria-describedby={undefined}
        data-testid="connect-wallet-modal"
      >
        <ConnectModalProvider
          config={config}
          onClose={handleClose}
          onConnect={onConnect}
        >
          <ModalContent />
        </ConnectModalProvider>
      </DialogContent>
    </Dialog>
  );
};
