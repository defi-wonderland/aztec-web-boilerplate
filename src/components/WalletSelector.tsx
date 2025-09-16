import React, { useState } from 'react';
import { useAztecWallet, useAzguardWallet } from '../hooks';
import { WalletType } from '../types/aztec';

interface WalletSelectorProps {
  onWalletConnected?: () => void;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ onWalletConnected }) => {
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType>(WalletType.EMBEDDED);
  const [testAccountIndex, setTestAccountIndex] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);

  const { 
    createAccount, 
    connectTestAccount, 
    connectExistingAccount 
  } = useAztecWallet();

  const { 
    state: azguardState, 
    connect: connectAzguard 
  } = useAzguardWallet();

  const handleEmbeddedWalletAction = async (action: 'create' | 'test' | 'existing') => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    try {
      switch (action) {
        case 'create':
          await createAccount();
          break;
        case 'test':
          await connectTestAccount(testAccountIndex - 1);
          break;
        case 'existing':
          await connectExistingAccount();
          break;
      }
      onWalletConnected?.();
    } catch (err) {
      console.error(`Failed to ${action} account:`, err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAzguardConnect = async () => {
    if (isConnecting || azguardState.isConnecting) return;
    
    setIsConnecting(true);
    try {
      await connectAzguard();
      onWalletConnected?.();
    } catch (err) {
      console.error('Failed to connect Azguard wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const renderWalletTypeSelector = () => (
    <div className="wallet-type-selector">
      <label htmlFor="wallet-type-select">Wallet Type:</label>
      <select
        id="wallet-type-select"
        value={selectedWalletType}
        onChange={(e) => setSelectedWalletType(e.target.value as WalletType)}
        className="wallet-type-select"
      >
        <option value={WalletType.EMBEDDED}>Embedded Wallet</option>
        <option value={WalletType.AZGUARD}>Azguard Wallet</option>
      </select>
    </div>
  );

  const renderEmbeddedWalletOptions = () => (
    <div className="embedded-wallet-options">
      <div className="test-account-selector">
        <label htmlFor="test-account-number">Test Account:</label>
        <select 
          id="test-account-number"
          value={testAccountIndex} 
          onChange={(e) => setTestAccountIndex(Number(e.target.value))}
          className="test-account-select"
        >
          <option value="1">Account 1</option>
          <option value="2">Account 2</option>
          <option value="3">Account 3</option>
        </select>
      </div>
      
      <div className="wallet-actions">
        <button 
          id="connect-test-account"
          onClick={() => handleEmbeddedWalletAction('test')}
          type="button"
          disabled={isConnecting}
          className="wallet-action-button"
        >
          {isConnecting ? 'Connecting...' : 'Connect Test Account'}
        </button>
        
        <button 
          onClick={() => handleEmbeddedWalletAction('create')}
          type="button"
          disabled={isConnecting}
          className="wallet-action-button"
        >
          {isConnecting ? 'Creating...' : 'Create Account'}
        </button>
        
        <button 
          onClick={() => handleEmbeddedWalletAction('existing')}
          type="button"
          disabled={isConnecting}
          className="wallet-action-button secondary"
        >
          {isConnecting ? 'Connecting...' : 'Connect Existing'}
        </button>
      </div>
    </div>
  );

  const renderAzguardWalletOptions = () => {
    if (!azguardState.isInstalled) {
      return (
        <div className="azguard-not-installed">
          <p>Azguard Wallet is not installed.</p>
          <a 
            href="https://chrome.google.com/webstore/detail/azguard-wallet" 
            target="_blank" 
            rel="noopener noreferrer"
            className="install-link"
          >
            Install Azguard Wallet
          </a>
        </div>
      );
    }

    if (azguardState.error) {
      return (
        <div className="azguard-error">
          <p>Error: {azguardState.error}</p>
          <button 
            onClick={handleAzguardConnect}
            type="button"
            disabled={isConnecting || azguardState.isConnecting}
            className="wallet-action-button"
          >
            Retry Connection
          </button>
        </div>
      );
    }

    return (
      <div className="azguard-wallet-options">
        <div className="azguard-info">
          <p>Connect your Azguard Wallet to access your Aztec accounts.</p>
          {azguardState.supportedChains.length > 0 && (
            <p className="supported-chains">
              Supported chains: {azguardState.supportedChains.join(', ')}
            </p>
          )}
        </div>
        
        <div className="wallet-actions">
          <button 
            onClick={handleAzguardConnect}
            type="button"
            disabled={isConnecting || azguardState.isConnecting}
            className="wallet-action-button primary"
          >
            {azguardState.isConnecting || isConnecting ? 'Connecting...' : 'Connect Azguard Wallet'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="wallet-selector">
      {renderWalletTypeSelector()}
      
      <div className="wallet-options">
        {selectedWalletType === WalletType.EMBEDDED && renderEmbeddedWalletOptions()}
        {selectedWalletType === WalletType.AZGUARD && renderAzguardWalletOptions()}
      </div>
    </div>
  );
};
