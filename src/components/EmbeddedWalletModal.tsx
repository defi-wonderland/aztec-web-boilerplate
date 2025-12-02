import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUniversalWallet, useConfig } from '../hooks';

interface EmbeddedWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected?: () => void;
}

export const EmbeddedWalletModal: React.FC<EmbeddedWalletModalProps> = ({ 
  isOpen, 
  onClose, 
  onWalletConnected 
}) => {
  const [testAccountIndex, setTestAccountIndex] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);

  const { 
    embedded,
    azguard,
    isInitialized,
    isLoading,
    error,
  } = useUniversalWallet();

  const { currentConfig, switchToNetwork } = useConfig();
  
  // Disable functionality when no network is selected, network is initializing, or failed
  const isNetworkSelected = currentConfig?.name && currentConfig.name !== '';
  const isNetworkInitializing = isNetworkSelected && !isInitialized && isLoading;
  const isNetworkFailed = isNetworkSelected && error && !isInitialized;
  const isTestAccountDisabled = !isNetworkSelected || isNetworkInitializing || isNetworkFailed || isConnecting;
  const isAzguardDisabled = !isNetworkSelected || isNetworkInitializing || isNetworkFailed || isConnecting || azguard.state.isConnected;

  // Apply modal-open class to root when modal is open
  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      if (isOpen) {
        rootElement.classList.add('modal-open');
      } else {
        rootElement.classList.remove('modal-open');
      }
    }

    // Cleanup on unmount
    return () => {
      if (rootElement) {
        rootElement.classList.remove('modal-open');
      }
    };
  }, [isOpen]);

  const handleEmbeddedWalletAction = async (action: 'create' | 'test') => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    try {
      switch (action) {
        case 'create':
          await embedded.create();
          break;
        case 'test':
          await embedded.connectTest(testAccountIndex - 1);
          break;
      }
      onWalletConnected?.();
      onClose(); // Close modal after successful connection
    } catch (err) {
      console.error(`Failed to ${action} account:`, err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAzguardConnect = async () => {
    if (isConnecting || azguard.state.isConnecting) return;
    
    try {
      await azguard.connect();
      onWalletConnected?.();
      onClose(); // Close modal after successful connection
    } catch (err) {
      console.error('Failed to connect Azguard wallet:', err);
    }
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkName = event.target.value;
    console.log('🔄 Network change requested from modal:', { 
      from: currentConfig.name, 
      to: networkName,
      currentConfig 
    });
    
    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };

  const renderNetworkSelector = () => {
    return (
      <div className="network-connect-section">
        <label className="wallet-section-label">Network</label>
        <div className="modal-network-selector">
          <div className="network-select-wrapper">
            <select
              id="modal-network-selector"
              name="modal-network-selector"
              value={currentConfig?.name || ""}
              onChange={handleNetworkChange}
              className="network-select"
              title="Select network configuration"
            >
              <option value="" disabled>Network</option>
              <option value="sandbox">Local Sandbox</option>
              <option value="testnet">Testnet</option>
            </select>
            <span className="network-select-arrow">▼</span>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Connect Wallet</h3>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <p className="modal-description">
            Create or connect to an Aztec account using a wallet.
          </p>
          
          {renderNetworkSelector()}
          
          <div className={`network-status ${
            !isNetworkSelected ? 'not-connected' : 
            isNetworkInitializing ? 'initializing' : 
            isNetworkFailed ? 'failed' :
            'connected'
          }`}>
            {!isNetworkSelected && (
              <span>Network not connected</span>
            )}
            {isNetworkInitializing && (
              <>
                <div className="initializing-spinner"></div>
                <span>Initializing network connection...</span>
              </>
            )}
            {isNetworkFailed && (
              <span>
                {currentConfig.name === 'sandbox' ? 'Local Sandbox connection failed' : 
                 currentConfig.name === 'testnet' ? 'Testnet connection failed' : 
                 `${currentConfig.displayName} connection failed`}
              </span>
            )}
            {isNetworkSelected && isInitialized && (
              <span>
                {currentConfig.name === 'sandbox' ? 'Local Sandbox connected' : 
                 currentConfig.name === 'testnet' ? 'Testnet connected' : 
                 `${currentConfig.displayName} connected`}
              </span>
            )}
          </div>
          
          <div className="azguard-connect-section">
            <label className="wallet-section-label">Browser Wallet</label>
            <button 
              onClick={handleAzguardConnect}
              type="button"
              disabled={isAzguardDisabled}
              className="modal-action-button azguard-connect"
              title={!isNetworkSelected ? 'Please select a network first' : isNetworkInitializing ? 'Network is initializing...' : isNetworkFailed ? 'Network connection failed' : ''}
            >
              {azguard.state.isConnecting ? 'Connecting...' : 
               azguard.state.isConnected ? 'Azguard Connected' : 
               'Connect Azguard Wallet'}
            </button>
          </div>
          
          <div className="embedded-connect-section">
            <label className="wallet-section-label">Embedded Wallet</label>
            
            {/* Only show test account section for Local Sandbox */}
            {currentConfig?.name === 'sandbox' && (
              <div className="test-account-selector">
                <label htmlFor="modal-test-account-number">Test Account:</label>
                <select 
                  id="modal-test-account-number"
                  value={testAccountIndex} 
                  onChange={(e) => setTestAccountIndex(Number(e.target.value))}
                  className="test-account-select"
                  disabled={isTestAccountDisabled}
                >
                  <option value="1">Account 1</option>
                  <option value="2">Account 2</option>
                  <option value="3">Account 3</option>
                </select>
                {!isNetworkSelected && (
                  <p className="network-notice">
                    Please select a network to continue.
                  </p>
                )}
              </div>
            )}
            
            <div className="modal-actions">
              {/* Only show test account button for Local Sandbox */}
              {currentConfig?.name === 'sandbox' && (
                <button 
                  onClick={() => handleEmbeddedWalletAction('test')}
                  type="button"
                  disabled={isTestAccountDisabled}
                  className="modal-action-button primary"
                  title={!isNetworkSelected ? 'Please select a network first' : isNetworkInitializing ? 'Network is initializing...' : isNetworkFailed ? 'Network connection failed' : ''}
                >
                  {isConnecting ? 'Connecting...' : 'Connect Test Account'}
                </button>
              )}
              
              <button 
                onClick={() => handleEmbeddedWalletAction('create')}
                type="button"
                disabled={!isNetworkSelected || isNetworkInitializing || isNetworkFailed || isConnecting}
                className="modal-action-button primary"
                title={!isNetworkSelected ? 'Please select a network first' : isNetworkInitializing ? 'Network is initializing...' : isNetworkFailed ? 'Network connection failed' : ''}
              >
                {isConnecting ? 'Creating...' : 'Create New Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};
