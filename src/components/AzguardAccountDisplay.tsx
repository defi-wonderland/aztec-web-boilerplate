import React from 'react';
import { useUniversalWallet, useAddressUtils } from '../hooks';
import type { CaipAccount } from '../types/azguard';

interface AzguardAccountDisplayProps {
  onDisconnect?: () => void;
}

export const AzguardAccountDisplay: React.FC<AzguardAccountDisplayProps> = ({ onDisconnect }) => {
  const { azguard, disconnect } = useUniversalWallet();
  const { truncateCaipAddress, getCaipChainName } = useAddressUtils();

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onDisconnect?.();
    } catch (err) {
      console.error('Failed to disconnect Azguard wallet:', err);
    }
  };

  const handleAccountSwitch = async (account: CaipAccount) => {
    if (account === azguard.state.selectedAccount) return;
    
    try {
      await azguard.switchAccount(account);
    } catch (err) {
      console.error('Failed to switch account:', err);
    }
  };

  if (!azguard.state.isConnected || !azguard.state.selectedAccount) {
    return null;
  }

  return (
    <div className="azguard-account-display">
      <div className="account-info">
        <div className="account-header">
          <span className="wallet-type">Azguard</span>
          <span className="chain-name">({getCaipChainName(azguard.state.selectedAccount)})</span>
        </div>
        
        <div className="account-address">
          {truncateCaipAddress(azguard.state.selectedAccount)}
        </div>
        
        {azguard.state.accounts.length > 1 && (
          <div className="account-selector">
            <select
              value={azguard.state.selectedAccount}
              onChange={(e) => handleAccountSwitch(e.target.value as CaipAccount)}
              className="account-select"
              title="Switch account"
            >
              {azguard.state.accounts.map((account, index) => (
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
