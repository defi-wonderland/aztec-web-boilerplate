import React from 'react';
import { useUniversalWallet, useAddressUtils } from '../hooks';
import { AzguardConnector } from '../connectors/AzguardConnector';

export const AzguardConnectButton: React.FC = () => {
  const { connectors, disconnect } = useUniversalWallet();
  const { truncateCaipAddress } = useAddressUtils();
  const azguardConnector = connectors.find(
    (conn): conn is AzguardConnector => conn instanceof AzguardConnector
  );
  const azguardStatus = azguardConnector?.getStatus();
  const selectedAccount = azguardConnector?.getCaipAccount?.();

  const handleClick = async () => {
    if (!azguardConnector) {
      return;
    }

    if (azguardStatus?.isConnected) {
      await disconnect();
    } else {
      await azguardConnector.connect();
    }
  };

  const getButtonText = () => {
    if (azguardStatus?.isConnecting) return 'Connecting...';
    if (azguardStatus?.isConnected && selectedAccount) {
      return truncateCaipAddress(selectedAccount);
    }
    return 'Connect Azguard';
  };

  return (
    <div className="azguard-wallet-section">
      <button
        onClick={handleClick}
        disabled={azguardStatus?.isConnecting}
        className={`azguard-connect-button ${azguardStatus?.isConnecting ? 'connecting' : ''} ${azguardStatus?.isConnected ? 'connected' : ''} ${azguardStatus?.error ? 'error' : ''}`}
        title={azguardStatus?.isConnected ? 'Click to disconnect' : 'Connect to Azguard Wallet'}
      >
        {getButtonText()}
      </button>
      
      {azguardStatus?.error && (
        <div className="azguard-error-message">
          {azguardStatus.error}
        </div>
      )}
    </div>
  );
};
