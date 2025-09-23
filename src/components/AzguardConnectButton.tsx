import React from 'react';
import { useAzguardWallet } from '../hooks';

export const AzguardConnectButton: React.FC = () => {
  const { state, connect, disconnect } = useAzguardWallet();

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
      const address = state.selectedAccount.split(':')[2];
      const truncated = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';
      return truncated;
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
