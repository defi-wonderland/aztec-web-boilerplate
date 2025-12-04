import React, { useState } from 'react';
import { useUniversalWallet } from '../hooks';
import { EmbeddedWalletModal } from './EmbeddedWalletModal';
import type { WalletConnector } from '../types/walletConnector';
import { EmbeddedConnector } from '../connectors/EmbeddedConnector';

interface WalletDropdownProps {
  onWalletConnected?: () => void;
}

export const WalletDropdown: React.FC<WalletDropdownProps> = ({ onWalletConnected }) => {
  const [isEmbeddedModalOpen, setIsEmbeddedModalOpen] = useState(false);
  
  const { connectors, connectWith } = useUniversalWallet();
  const isAnyWalletConnected = connectors.some(
    (connector) => connector.getStatus().isConnected
  );

  const handleConnectorClick = async (connector: WalletConnector) => {
    if (connector instanceof EmbeddedConnector) {
      setIsEmbeddedModalOpen(true);
      return;
    }

    try {
      await connectWith(connector.id);
      onWalletConnected?.();
    } catch (error) {
      console.error(`Failed to connect ${connector.label} wallet:`, error);
    }
  };
  
  const handleEmbeddedModalClose = () => {
    setIsEmbeddedModalOpen(false);
  };

  const handleEmbeddedWalletConnected = () => {
    setIsEmbeddedModalOpen(false);
    onWalletConnected?.();
  };

  if (isAnyWalletConnected) {
    return null;
  }

  return (
    <>
      <div className="wallet-dropdown">
        <div className="wallet-select-wrapper">
          <div className="wallet-options">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                className="wallet-option-button"
                onClick={() => handleConnectorClick(connector)}
              >
                {connector.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <EmbeddedWalletModal
        isOpen={isEmbeddedModalOpen}
        onClose={handleEmbeddedModalClose}
        onWalletConnected={handleEmbeddedWalletConnected}
      />
    </>
  );
};
