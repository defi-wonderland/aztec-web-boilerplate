import React, { useCallback } from 'react';
import { Hammer } from 'lucide-react';
import { useUniversalWallet, useModal, MODAL_IDS, useToast } from '../hooks';
import { WalletType } from '../types/aztec';
import { isBrowserWalletConnector } from '../types/walletConnector';
import {
  truncateAddress,
  truncateCaipAddress,
  parseCaipAddress,
  iconSize,
} from '../utils';
import { copyToClipboard } from '../utils/clipboard';
import { ConnectWalletModal } from './ConnectWalletModal';
import {
  ThemeToggle,
  Button,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from './ui';

const styles = {
  // Navbar container
  navbar:
    'sticky top-0 z-40 w-full backdrop-blur-md bg-surface/80 border-b border-default',
  navContainer:
    'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16',
  // Logo/Title
  navTitle: 'text-xl font-semibold text-default flex items-center gap-2',
  navTitleIcon: 'text-accent',
  // Controls section
  navControls: 'flex items-center gap-3',
  // Connected account section
  accountSection: 'flex items-center gap-2',
  walletBadge: 'hidden sm:inline-flex',
  addressButton: 'font-mono',
} as const;

interface ConnectedAccountProps {
  walletName: string;
  address: string;
  onDisconnect: () => void;
}

/**
 * Connected account display with copy and disconnect actions.
 */
const ConnectedAccount: React.FC<ConnectedAccountProps> = ({
  walletName,
  address,
  onDisconnect,
}) => {
  const { success } = useToast();

  const caipParts = parseCaipAddress(address);
  const displayAddress = caipParts
    ? truncateCaipAddress(address)
    : truncateAddress(address);
  const copyAddress = caipParts?.address ?? address;

  const handleCopy = async () => {
    await copyToClipboard(copyAddress, {
      onSuccess: () => success('Address copied', displayAddress),
    });
  };

  return (
    <div className={styles.accountSection} data-testid="connected-account">
      <Badge variant="primary" className={styles.walletBadge}>
        {walletName}
      </Badge>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy connected address"
            className={styles.addressButton}
            data-testid="account-address"
          >
            {displayAddress}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Click to copy full address</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="danger-outline" size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        </TooltipTrigger>
        <TooltipContent>Disconnect wallet</TooltipContent>
      </Tooltip>
    </div>
  );
};

/**
 * Application header with wallet connection and theme toggle.
 */
export const Header: React.FC = () => {
  const { account, walletType, disconnect, connector } = useUniversalWallet();
  const { open: openWalletModal, close: closeWalletModal } = useModal(
    MODAL_IDS.CONNECT_WALLET
  );

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleWalletConnected = useCallback(() => {
    closeWalletModal();
  }, [closeWalletModal]);

  const renderAccountSection = () => {
    const status = connector?.getStatus();
    const caipAccount = isBrowserWalletConnector(connector)
      ? connector.getCaipAccount()
      : null;
    const walletName =
      connector?.label ??
      (walletType === WalletType.EMBEDDED
        ? 'Embedded'
        : walletType === WalletType.BROWSER_WALLET
          ? 'Browser'
          : 'Wallet');
    const address = caipAccount ?? account?.getAddress().toString() ?? '';

    if (status?.status === 'connected' && address) {
      return (
        <ConnectedAccount
          walletName={walletName}
          address={address}
          onDisconnect={handleDisconnect}
        />
      );
    }

    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={openWalletModal}
        data-testid="connect-wallet-button"
      >
        Connect Wallet
      </Button>
    );
  };

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.navTitle}>
            <Hammer size={iconSize('lg')} className={styles.navTitleIcon} />
            Aztec Web Boilerplate
          </div>
          <div className={styles.navControls}>
            {renderAccountSection()}
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <ConnectWalletModal onWalletConnected={handleWalletConnected} />
    </>
  );
};
