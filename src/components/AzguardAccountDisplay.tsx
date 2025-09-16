import React from 'react';
import { useAzguardWallet } from '../hooks';
import type { CaipAccount } from '../types/azguard';

interface AzguardAccountDisplayProps {
  onDisconnect?: () => void;
}

export const AzguardAccountDisplay: React.FC<AzguardAccountDisplayProps> = ({ onDisconnect }) => {
  const { state, disconnect, switchAccount } = useAzguardWallet();

  const formatCaipAccount = (account: CaipAccount): string => {
    // Extract address from CAIP format: aztec:chainId:address
    const parts = account.split(':');
    if (parts.length === 3) {
      const address = parts[2];
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return account;
  };

  const getChainName = (account: CaipAccount): string => {
    const parts = account.split(':');
    if (parts.length === 3) {
      const chainId = parts[1];
      switch (chainId) {
        case '31337':
          return 'Sandbox';
        case '11155111':
          return 'Testnet';
        case '1337':
          return 'Devnet';
        default:
          return `Chain ${chainId}`;
      }
    }
    return 'Unknown';
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onDisconnect?.();
    } catch (err) {
      console.error('Failed to disconnect Azguard wallet:', err);
    }
  };

  const handleAccountSwitch = async (account: CaipAccount) => {
    if (account === state.selectedAccount) return;
    
    try {
      await switchAccount(account);
    } catch (err) {
      console.error('Failed to switch account:', err);
    }
  };

  if (!state.isConnected || !state.selectedAccount) {
    return null;
  }

  return (
    <div className="azguard-account-display">
      <div className="account-info">
        <div className="account-header">
          <span className="wallet-type">Azguard</span>
          <span className="chain-name">({getChainName(state.selectedAccount)})</span>
        </div>
        
        <div className="account-address">
          {formatCaipAccount(state.selectedAccount)}
        </div>
        
        {state.accounts.length > 1 && (
          <div className="account-selector">
            <select
              value={state.selectedAccount}
              onChange={(e) => handleAccountSwitch(e.target.value as CaipAccount)}
              className="account-select"
              title="Switch account"
            >
              {state.accounts.map((account, index) => (
                <option key={account} value={account}>
                  Account {index + 1}: {formatCaipAccount(account)}
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
