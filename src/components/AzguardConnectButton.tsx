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
    if (state.isConnecting) {
      return 'Connecting...';
    }
    
    if (state.isConnected && state.selectedAccount) {
      // Extract address from CAIP format (aztec:chainId:address)
      const address = state.selectedAccount.split(':')[2];
      const truncated = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';
      return truncated;
    }
    
    return 'Connect Azguard';
  };

  const getButtonClass = () => {
    let baseClass = 'azguard-connect-button';
    
    if (state.isConnecting) {
      baseClass += ' connecting';
    } else if (state.isConnected) {
      baseClass += ' connected';
    }
    
    if (state.error) {
      baseClass += ' error';
    }
    
    return baseClass;
  };

  return (
    <div className="azguard-wallet-section">
      <button
        onClick={handleClick}
        disabled={state.isConnecting}
        className={getButtonClass()}
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
