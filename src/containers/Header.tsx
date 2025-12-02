import React, { useState, useCallback } from 'react';
import { useUniversalWallet, useAddressUtils } from '../hooks';
import { ThemeToggle, EmbeddedWalletModal } from '../components';
import { WalletType } from '../types/aztec';

// Sub-components
const ConnectedAccount: React.FC<{
  walletType: 'Azguard' | 'Embedded';
  address: string;
  onDisconnect: () => void;
}> = ({ walletType, address, onDisconnect }) => (
  <div className="connected-account-section">
    <span className="wallet-type">{walletType}</span>
    <span className="account-address">{address}</span>
    <button onClick={onDisconnect} type="button" className="disconnect-button">
      Disconnect
    </button>
  </div>
);

const ConnectButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="wallet-connect-button" type="button">
    Connect Wallet
  </button>
);

export const Header: React.FC = () => {
  const { account, walletType, disconnect, azguard } = useUniversalWallet();
  const { truncateAddress, truncateCaipAddress } = useAddressUtils();
  
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleWalletConnected = useCallback(() => {
    setShowWalletModal(false);
  }, []);

  const renderAccountSection = () => {
    // Azguard wallet takes priority
    if (azguard.state.isConnected && azguard.state.selectedAccount) {
      return (
        <ConnectedAccount
          walletType="Azguard"
          address={truncateCaipAddress(azguard.state.selectedAccount)}
          onDisconnect={handleDisconnect}
        />
      );
    }

    // Embedded wallet
    if (account && walletType === WalletType.EMBEDDED) {
      return (
        <ConnectedAccount
          walletType="Embedded"
          address={truncateAddress(account.getAddress().toString())}
          onDisconnect={handleDisconnect}
        />
      );
    }

    // No wallet connected
    return <ConnectButton onClick={() => setShowWalletModal(true)} />;
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-title">Aztec Web Boilerplate</div>
          <div className="nav-controls">
            <div className="account-controls">
              {renderAccountSection()}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      
      <EmbeddedWalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onWalletConnected={handleWalletConnected}
      />
    </>
  );
};
