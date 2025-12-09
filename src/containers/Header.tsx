import React, { useState, useCallback } from 'react';
import { useUniversalWallet, useAddressUtils } from '../hooks';
import { ThemeToggle, EmbeddedWalletModal } from '../components';
import { WalletType } from '../types/aztec';
import { AzguardConnector } from '../connectors/AzguardConnector';

// Sub-components
const ConnectedAccount: React.FC<{
  walletType: 'Azguard' | 'Embedded' | 'MetaMask';
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
  const { account, walletType, disconnect, connectors } = useUniversalWallet();
  const { truncateAddress, truncateCaipAddress } = useAddressUtils();
  const azguardConnector = connectors.find(
    (conn): conn is AzguardConnector => conn instanceof AzguardConnector
  );
  const azguardStatus = azguardConnector?.getStatus();
  const azguardAccount = azguardConnector?.getCaipAccount?.();
  
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleWalletConnected = useCallback(() => {
    setShowWalletModal(false);
  }, []);

  const renderAccountSection = () => {
    // Determine wallet label and address
    let walletLabel: 'Azguard' | 'Embedded' | 'MetaMask' | null = null;
    let address: string | null = null;

    if (azguardStatus?.isConnected && azguardAccount) {
      walletLabel = 'Azguard';
      address = truncateCaipAddress(azguardAccount);
    } else if (account) {
      address = truncateAddress(account.getAddress().toString());
      if (walletType === WalletType.EMBEDDED) {
        walletLabel = 'Embedded';
      } else if (walletType === WalletType.METAMASK) {
        walletLabel = 'MetaMask';
      }
    }

    if (walletLabel && address) {
      return (
        <ConnectedAccount
          walletType={walletLabel}
          address={address}
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
