import React, { useEffect, useState } from 'react';
import { useAztecWallet, useConfig, useAzguardWallet } from '../hooks';
import { AzguardAccountDisplay, ThemeToggle, EmbeddedWalletModal } from '../components';

export const Header: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    initializationTimedOut,
    forceShowWalletSelector,
    disconnectWallet
  } = useAztecWallet();
  
  const [showWalletModal, setShowWalletModal] = useState(false);

  const { state: azguardState, disconnect: disconnectAzguard } = useAzguardWallet();
  const { currentConfig } = useConfig();

  const handleDisconnect = () => {
    if (azguardState.isConnected) {
      // Disconnect Azguard wallet
      disconnectAzguard();
    } else if (connectedAccount) {
      // Disconnect embedded wallet
      disconnectWallet();
    }
  };

  
  const isAnyWalletConnected = connectedAccount || azguardState.isConnected;
  const accountAddress = connectedAccount?.getAddress().toString();
  const truncatedAddress = accountAddress ? `${accountAddress.slice(0, 4)}...${accountAddress.slice(-4)}` : '';

  const renderAccountSection = () => {
    // Show Azguard account if connected (prioritize over initialization state)
    if (azguardState.isConnected && azguardState.selectedAccount) {
      const azguardAddress = azguardState.selectedAccount.split(':')[2];
      const truncatedAzguardAddress = azguardAddress ? `${azguardAddress.slice(0, 4)}...${azguardAddress.slice(-4)}` : '';
      
      return (
        <div className="connected-account-section">
          <span className="wallet-type">Azguard</span>
          <span className="account-address">{truncatedAzguardAddress}</span>
          <button 
            onClick={handleDisconnect}
            type="button"
            className="disconnect-button"
          >
            Disconnect
          </button>
        </div>
      );
    }

    // Show embedded wallet account if connected (prioritize over initialization state)
    if (connectedAccount) {
      return (
        <div className="connected-account-section">
          <span className="wallet-type">Embedded</span>
          <span className="account-address">{truncatedAddress}</span>
          <button 
            onClick={handleDisconnect}
            type="button"
            className="disconnect-button"
          >
            Disconnect
          </button>
        </div>
      );
    }

    // Show wallet button if no wallet is connected
    return (
      <button 
        onClick={() => setShowWalletModal(true)}
        className="wallet-connect-button"
        type="button"
      >
        Connect Wallet
      </button>
    );
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
        onWalletConnected={() => setShowWalletModal(false)}
      />
    </>
  );
};
