import React, { useEffect, useState } from 'react';
import { useAztecWallet, useConfig, useAzguardWallet } from '../hooks';
import { WalletSelector, AzguardAccountDisplay } from '../components';

export const Header: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    disconnectWallet
  } = useAztecWallet();

  const { state: azguardState } = useAzguardWallet();
  const { currentConfig, switchToNetwork, getNetworkOptions } = useConfig();

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkName = event.target.value;
    console.log('🔄 Network change requested:', { 
      from: currentConfig.name, 
      to: networkName,
      currentConfig 
    });
    
    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };
  
  const isAnyWalletConnected = connectedAccount || azguardState.isConnected;
  const accountAddress = connectedAccount?.getAddress().toString();
  const truncatedAddress = accountAddress ? `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}` : '';

  const renderAccountSection = () => {
    if (!isInitialized) {
      return <div className="initializing">Initializing...</div>;
    }

    // Show Azguard account if connected
    if (azguardState.isConnected) {
      return <AzguardAccountDisplay onDisconnect={handleDisconnect} />;
    }

    // Show embedded wallet account if connected
    if (connectedAccount) {
      return (
        <div className="connected-account-section">
          <div className="account-info">
            <span className="wallet-type">Embedded</span>
            <div id="account-display" className="account-display">
              {truncatedAddress}
            </div>
          </div>
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

    // Show wallet selector if no wallet is connected
    return <WalletSelector onWalletConnected={() => {}} />;
  };

  // Auto-initialization removed - users now choose wallet type explicitly
  
  const renderNetworkSelector = () => {
    if (!isInitialized) {
      return null;
    }

    const networkOptions = getNetworkOptions();
    
    // Get display text for current network
    const getNetworkDisplayText = () => {
      if (currentConfig.name === 'sandbox') return 'Local Sandbox';
      if (currentConfig.name === 'testnet') return 'Testnet';
      return currentConfig.name;
    };

    return (
      <div className="network-selector">
        <div className="network-select-wrapper">
          <select
            name="network-selector"
            value={currentConfig.name}
            onChange={handleNetworkChange}
            className="network-select"
            title="Select network configuration"
          >
            <option value="" disabled>Network</option>
            <option value="sandbox">Local Sandbox</option>
            <option value="testnet">Testnet</option>
          </select>
          <span className="network-select-arrow">▼</span>
        </div>
      </div>
    );
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-title">Bridge and Seek</div>

            <div className="nav-controls">
              {renderNetworkSelector()}
              <div className="account-controls">
                {renderAccountSection()}
              </div>
            </div>
      </div>
    </nav>
  );
};
