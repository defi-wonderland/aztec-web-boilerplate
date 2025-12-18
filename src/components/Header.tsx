import React, { useState, useCallback } from 'react';
import { truncateAddress, truncateCaipAddress } from '../utils';
import { useUniversalWallet } from '../hooks';
import { ThemeToggle } from './ThemeToggle';
import { ConnectWalletModal } from './ConnectWalletModal';
import { WalletType } from '../types/aztec';

interface ConnectedAccountProps {
  walletName: string;
  address: string;
  onDisconnect: () => void;
}

const ConnectedAccount: React.FC<ConnectedAccountProps> = ({
  walletName,
  address,
  onDisconnect,
}) => (
  <div className="connected-account-section">
    <span className="wallet-type">{walletName}</span>
    <span className="account-address">{address}</span>
    <button onClick={onDisconnect} type="button" className="disconnect-button">
      Disconnect
    </button>
  </div>
);

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
    const displayAddress = caipAccount
      ? truncateCaipAddress(caipAccount)
      : account
        ? truncateAddress(account.getAddress().toString())
        : null;

    if (status?.status === 'connected' && displayAddress) {
      return (
        <ConnectedAccount
          walletName={walletName}
          address={displayAddress}
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
