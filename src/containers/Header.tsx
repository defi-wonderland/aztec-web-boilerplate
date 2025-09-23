import React, { useEffect, useState } from 'react';
import { useAztecWallet, useConfig, useAzguardWallet, useAddressUtils } from '../hooks';
import { WalletSelector, AzguardAccountDisplay } from '../components';

export const Header: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    disconnectWallet
  } = useAztecWallet();

  const { state: azguardState, disconnect: disconnectAzguard } = useAzguardWallet();
  const { currentConfig, switchToNetwork, getNetworkOptions } = useConfig();
  const { truncateAddress, truncateCaipAddress } = useAddressUtils();

  const handleDisconnect = () => {
    if (azguardState.isConnected) {
      // Disconnect Azguard wallet
      disconnectAzguard();
    } else if (connectedAccount) {
      // Disconnect embedded wallet
      disconnectWallet();
    }
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
  
  const accountAddress = connectedAccount?.getAddress().toString();

  const renderAccountSection = () => {
    if (!isInitialized) {
      return <div className="initializing">Initializing...</div>;
    }

    // Show Azguard account if connected
    if (azguardState.isConnected && azguardState.selectedAccount) {
      return (
        <div className="connected-account-section">
          <span className="wallet-type">Azguard</span>
          <span className="account-address">{truncateCaipAddress(azguardState.selectedAccount)}</span>
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

    // Show embedded wallet account if connected
    if (connectedAccount) {
      return (
        <div className="connected-account-section">
          <span className="wallet-type">Embedded</span>
          <span className="account-address">{truncateAddress(accountAddress)}</span>
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

    return <WalletSelector onWalletConnected={() => {}} />;
  };
  
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
