import React from 'react';
import { useUniversalWallet, useAddressUtils } from '../hooks';
import type { CaipAccount } from '../types/azguard';
import { AzguardConnector } from '../connectors/AzguardConnector';

interface AzguardAccountDisplayProps {
  onDisconnect?: () => void;
}

export const AzguardAccountDisplay: React.FC<AzguardAccountDisplayProps> = ({ onDisconnect }) => {
  const { connectors, disconnect } = useUniversalWallet();
  const { truncateCaipAddress, getCaipChainName } = useAddressUtils();
  const azguardConnector = connectors.find(
    (conn): conn is AzguardConnector => conn instanceof AzguardConnector
  );
  const azguardStatus = azguardConnector?.getStatus();
  const selectedAccount = azguardConnector?.getCaipAccount?.() ?? null;
  const accounts = azguardConnector?.getAccounts?.() ?? [];

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onDisconnect?.();
    } catch (err) {
      console.error('Failed to disconnect Azguard wallet:', err);
    }
  };

  const handleAccountSwitch = async (account: CaipAccount) => {
    if (!azguardConnector || account === selectedAccount) return;
    
    try {
      await azguardConnector.switchAccount?.(account);
    } catch (err) {
      console.error('Failed to switch account:', err);
    }
  };

  if (!azguardStatus?.isConnected || !selectedAccount) {
    return null;
  }

  return (
    <div className="azguard-account-display">
      <div className="account-info">
        <div className="account-header">
          <span className="wallet-type">Azguard</span>
          <span className="chain-name">({getCaipChainName(selectedAccount)})</span>
        </div>
        
        <div className="account-address">
          {truncateCaipAddress(selectedAccount)}
        </div>
        
        {accounts.length > 1 && (
          <div className="account-selector">
            <select
              value={selectedAccount}
              onChange={(e) => handleAccountSwitch(e.target.value as CaipAccount)}
              className="account-select"
              title="Switch account"
            >
              {accounts.map((account, index) => (
                <option key={account} value={account}>
                  Account {index + 1}: {truncateCaipAddress(account)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <button 
        onClick={handleDisconnect}
        type="button"
        className="disconnect-button"
        title="Disconnect Azguard wallet"
      >
        Disconnect
      </button>
    </div>
  );
};
