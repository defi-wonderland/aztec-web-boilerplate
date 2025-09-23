import React from 'react';
import { useAzguardWallet, useAddressUtils } from '../hooks';

export const AzguardConnectButton: React.FC = () => {
  const { state, connect, disconnect } = useAzguardWallet();
  const { truncateCaipAddress } = useAddressUtils();

  const handleClick = async () => {
    if (state.isConnected) {
      await disconnect();
    } else {
      await connect();
    }
  };

  const getButtonText = () => {
    if (state.isConnecting) return 'Connecting...';
    if (state.isConnected && state.selectedAccount) {
      return truncateCaipAddress(state.selectedAccount);
    }
    return 'Connect Azguard';
  };

  return (
    <div className="azguard-wallet-section">
      <button
        onClick={handleClick}
        disabled={state.isConnecting}
        className={`azguard-connect-button ${state.isConnecting ? 'connecting' : ''} ${state.isConnected ? 'connected' : ''} ${state.error ? 'error' : ''}`}
        title={state.isConnected ? 'Click to disconnect' : 'Connect to Azguard Wallet'}
      >
        {getButtonText()}
      </button>
      
      {state.error && (
        <div className="azguard-error-message">
          {state.error}
        </div>
      )}
    </div>
  );
};
