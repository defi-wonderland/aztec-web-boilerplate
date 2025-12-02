import React from 'react';
import { useUniversalWallet, useAddressUtils } from '../hooks';

export const AzguardConnectButton: React.FC = () => {
  const { azguard, disconnect } = useUniversalWallet();
  const { truncateCaipAddress } = useAddressUtils();

  const handleClick = async () => {
    if (azguard.state.isConnected) {
      await disconnect();
    } else {
      await azguard.connect();
    }
  };

  const getButtonText = () => {
    if (azguard.state.isConnecting) return 'Connecting...';
    if (azguard.state.isConnected && azguard.state.selectedAccount) {
      return truncateCaipAddress(azguard.state.selectedAccount);
    }
    return 'Connect Azguard';
  };

  return (
    <div className="azguard-wallet-section">
      <button
        onClick={handleClick}
        disabled={azguard.state.isConnecting}
        className={`azguard-connect-button ${azguard.state.isConnecting ? 'connecting' : ''} ${azguard.state.isConnected ? 'connected' : ''} ${azguard.state.error ? 'error' : ''}`}
        title={azguard.state.isConnected ? 'Click to disconnect' : 'Connect to Azguard Wallet'}
      >
        {getButtonText()}
      </button>
      
      {azguard.state.error && (
        <div className="azguard-error-message">
          {azguard.state.error}
        </div>
      )}
    </div>
  );
};
