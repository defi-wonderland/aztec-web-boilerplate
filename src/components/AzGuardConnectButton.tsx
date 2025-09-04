import React from 'react';
import { useEVMWallet } from '../hooks';

interface AzGuardConnectButtonProps {
  showBalance?: boolean;
  accountStatus?: 'full' | 'avatar' | 'address';
}

export const AzGuardConnectButton: React.FC<AzGuardConnectButtonProps> = ({ 
  showBalance = false, 
  accountStatus = 'full' 
}) => {
  const { 
    account, 
    balance, 
    isConnected, 
    isConnecting, 
    isSupported, 
    connect, 
    disconnect 
  } = useEVMWallet();

  if (!isSupported) {
    return (
      <button 
        className="azguard-connect-button unsupported"
        disabled
      >
        AzGuard Not Available
      </button>
    );
  }

  if (isConnecting) {
    return (
      <button 
        className="azguard-connect-button connecting"
        disabled
      >
        Connecting...
      </button>
    );
  }

  if (!isConnected || !account) {
    return (
      <button 
        className="azguard-connect-button"
        onClick={connect}
      >
        Connect AzGuard Wallet
      </button>
    );
  }

  const formatAddress = (address: string) => {
    if (accountStatus === 'address' || accountStatus === 'full') {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(4);
  };

  return (
    <div className="azguard-wallet-info">
      {showBalance && balance && (
        <div className="azguard-balance">
          {formatBalance(balance.formatted)} {balance.symbol}
        </div>
      )}
      <button 
        className="azguard-connect-button connected"
        onClick={disconnect}
        title={account.address}
      >
        {formatAddress(account.address)}
      </button>
    </div>
  );
};

