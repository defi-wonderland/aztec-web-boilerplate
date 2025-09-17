import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAztecWallet, useConfig } from '../hooks';

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
    createAccount, 
    connectTestAccount
  } = useAztecWallet();

  const { currentConfig } = useConfig();
  
  // Disable test account functionality on testnet
  const isTestnet = currentConfig.name === 'testnet';
  const isTestAccountDisabled = isTestnet || isConnecting;

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
          await createAccount();
          break;
        case 'test':
          await connectTestAccount(testAccountIndex - 1);
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

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Embedded Wallet Configuration</h3>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <p className="modal-description">
            Create or connect to an Aztec account using the embedded wallet.
          </p>
          
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
            {isTestnet && (
              <p className="testnet-notice">
                Test accounts are not available on testnet. Please create a new account instead.
              </p>
            )}
          </div>
          
          <div className="modal-actions">
            <button 
              onClick={() => handleEmbeddedWalletAction('test')}
              type="button"
              disabled={isTestAccountDisabled}
              className="modal-action-button primary"
              title={isTestnet ? 'Test accounts are not available on testnet' : ''}
            >
              {isConnecting ? 'Connecting...' : 'Connect Test Account'}
            </button>
            
            <button 
              onClick={() => handleEmbeddedWalletAction('create')}
              type="button"
              disabled={isConnecting}
              className="modal-action-button primary"
            >
              {isConnecting ? 'Creating...' : 'Create New Account'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};
