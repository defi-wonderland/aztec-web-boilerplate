import React, { useEffect, useState } from 'react';
import { useAztecWallet, useConfig } from '../hooks';
import { ThemeToggle, AzGuardConnectButton } from '../components';

export const Header: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    createAccount, 
    connectTestAccount, 
    connectExistingAccount,
    disconnectWallet
  } = useAztecWallet();

  const { currentConfig, switchToNetwork, getNetworkOptions } = useConfig();
  const [testAccountIndex, setTestAccountIndex] = useState(1);

  const handleCreateAccount = async () => {
    try {
      await createAccount();
    } catch (err) {
      console.error('Failed to create account:', err);
    }
  };

  const handleConnectTestAccount = async () => {
    try {
      await connectTestAccount(testAccountIndex - 1);
    } catch (err) {
      console.error('Failed to connect test account:', err);
    }
  };

  const handleConnectExisting = async () => {
    try {
      await connectExistingAccount();
    } catch (err) {
      console.error('Failed to connect existing account:', err);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkName = event.target.value;
    console.log('🔄 Network change requested:', { 
      from: currentConfig.name, 
      to: networkName,
      currentConfig 
    });
    
    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };
  
  const showAccountOptions = !connectedAccount;

  const renderAccountSection = () => {
    if (!isInitialized) {
      return <div className="initializing">Initializing...</div>;
    }

    if (connectedAccount) {
      return (
        <div className="connected-account-section">
          <div id="account-display" className="account-display">
            Account: {connectedAccount.getAddress().toString().slice(0, 6)}...{connectedAccount.getAddress().toString().slice(-4)}
          </div>
          <button 
            onClick={handleDisconnect}
            type="button"
            className="disconnect-button"
          >
            Disconnect
          </button>
        </div>
      );
    }

    return (
      <>
        <select 
          id="test-account-number"
          value={testAccountIndex} 
          onChange={(e) => setTestAccountIndex(Number(e.target.value))}
          style={{ display: showAccountOptions ? 'block' : 'none' }}
        >
          <option value="1">Account 1</option>
          <option value="2">Account 2</option>
          <option value="3">Account 3</option>
        </select>
        <button 
          id="connect-test-account"
          onClick={handleConnectTestAccount}
          type="button" 
          style={{ display: showAccountOptions ? 'block' : 'none' }}
        >
          Connect Test Account
        </button>
        <button 
          onClick={handleCreateAccount}
          type="button" 
          style={{ display: showAccountOptions ? 'block' : 'none' }}
        >
          Create Account
        </button>
      </>
    );
  };

  useEffect(() => {
    if (isInitialized) {
      handleConnectExisting();
    }
  }, [isInitialized]);
  
  const renderNetworkSelector = () => {
    if (!isInitialized) {
      return null;
    }

    const networkOptions = getNetworkOptions();

    return (
      <div className="network-selector">
        <select
          name="network-selector"
          value={currentConfig.name}
          onChange={handleNetworkChange}
          className="network-select"
          title="Select network configuration"
        >
          {networkOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

      </div>
    );
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-title">Azt95.exe</div>

        <div className="nav-controls">
          {renderNetworkSelector()}
          <div className="account-controls">
            {renderAccountSection()}
          </div>
          <div className="evm-wallet-controls">
            <AzGuardConnectButton showBalance={false} accountStatus="address" />
          </div>
        </div>
        
        <div className="nav-theme-toggle">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};
