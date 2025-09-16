import React, { useEffect, useState } from 'react';
import { useAztecWallet, useConfig, useEVMWallet, useAzguardWallet } from '../hooks';
import { ConnectButton } from '@rainbow-me/rainbowkit';
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

    return (
      <div className="network-selector">
        <select
          name="network-selector"
          value={currentConfig.name}
          onChange={handleNetworkChange}
          className="network-select"
          title="Select network configuration"
        >
          {networkOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

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
          <div className="evm-wallet-controls">
            <ConnectButton showBalance={false} accountStatus="address" />
          </div>
        </div>
      </div>
    </nav>
  );
};
