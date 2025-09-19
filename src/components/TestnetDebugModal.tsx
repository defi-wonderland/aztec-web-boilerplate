import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TestnetDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForceShowWalletSelector: () => void;
}

export const TestnetDebugModal: React.FC<TestnetDebugModalProps> = ({
  isOpen,
  onClose,
  onForceShowWalletSelector,
}) => {
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

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content testnet-debug-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚠️ Testnet Connection Issue</h2>
          <button 
            className="modal-close-button" 
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="debug-message">
            <p>
              The Aztec testnet is not responding or has breaking changes that prevent wallet initialization.
            </p>
          </div>
          
          <div className="debug-details">
            <h4>Technical Details:</h4>
            <ul>
              <li>Network: Testnet (https://aztec-alpha-testnet-fullnode.zkv.xyz/)</li>
              <li>Status: Initialization failed immediately</li>
              <li>Error: Missing required fields (classRegisterer, instanceDeployer)</li>
            </ul>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className="modal-button secondary" 
            onClick={onClose}
          >
            Dismiss
          </button>
          <button 
            className="modal-button primary" 
            onClick={onForceShowWalletSelector}
          >
            Display Wallet Selector Anyway
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
};
