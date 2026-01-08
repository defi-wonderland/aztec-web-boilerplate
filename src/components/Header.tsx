import React, { useState, useCallback } from 'react';
import { useUniversalWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';
import { WalletType } from '../types/aztec';
import {
  truncateAddress,
  truncateCaipAddress,
  parseCaipAddress,
} from '../utils';
import { copyToClipboard } from '../utils/clipboard';
import { ConnectWalletModal } from './ConnectWalletModal';
import { ThemeToggle } from './ThemeToggle';

interface ConnectedAccountProps {
  walletName: string;
  address: string;
  onDisconnect: () => void;
}

const ConnectedAccount: React.FC<ConnectedAccountProps> = ({
  walletName,
  address,
  onDisconnect,
}) => {
  const { addMessage } = useError();

  const caipParts = parseCaipAddress(address);
  const displayAddress = caipParts
    ? truncateCaipAddress(address)
    : truncateAddress(address);
  const copyAddress = caipParts?.address ?? address;

  const handleCopy = async () => {
    await copyToClipboard(copyAddress, {
      onSuccess: () =>
        addMessage({
          message: `${walletName} address copied: ${copyAddress}`,
          type: 'success',
        }),
    });
  };

  return (
    <div className="connected-account-section">
      <span className="wallet-type">{walletName}</span>
      <button
        type="button"
        className="account-address"
        onClick={handleCopy}
        aria-label="Copy connected address"
        title="Copy address"
      >
        {displayAddress}
      </button>
      <button
        onClick={onDisconnect}
        type="button"
        className="disconnect-button"
      >
        Disconnect
      </button>
    </div>
  );
};

interface ConnectButtonProps {
  onClick: () => void;
}

const ConnectButton: React.FC<ConnectButtonProps> = ({ onClick }) => (
  <button onClick={onClick} className="wallet-connect-button" type="button">
    Connect Wallet
  </button>
);

export const Header: React.FC = () => {
  const { account, walletType, disconnect, connector } = useUniversalWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleWalletConnected = useCallback(() => {
    setShowWalletModal(false);
  }, []);

  const renderAccountSection = () => {
    const status = connector?.getStatus();
    const caipAccount = connector?.getCaipAccount?.();
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

    return <ConnectButton onClick={() => setShowWalletModal(true)} />;
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-title">Aztec Web Boilerplate</div>
          <div className="nav-controls">
            <div className="account-controls">{renderAccountSection()}</div>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <ConnectWalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onWalletConnected={handleWalletConnected}
      />
    </>
  );
};
