import React, { useState } from 'react';
import { useUniversalWallet } from '../hooks';
import { EmbeddedWalletModal } from './EmbeddedWalletModal';
import { WalletType } from '../types/aztec';

interface WalletDropdownProps {
  onWalletConnected?: () => void;
}

export const WalletDropdown: React.FC<WalletDropdownProps> = ({ onWalletConnected }) => {
  const [isEmbeddedModalOpen, setIsEmbeddedModalOpen] = useState(false);
  
  const { account, walletType, azguard } = useUniversalWallet();

  // Determine current wallet status
  const isEmbeddedConnected = !!account && walletType === WalletType.EMBEDDED;
  const isAzguardConnected = azguard.state.isConnected;
  const isAnyWalletConnected = isEmbeddedConnected || isAzguardConnected;

  const handleWalletTypeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newWalletType = event.target.value as WalletType;

    if (newWalletType === WalletType.EMBEDDED) {
      setIsEmbeddedModalOpen(true);
    } else if (newWalletType === WalletType.AZGUARD) {
      try {
        await azguard.connect();
        onWalletConnected?.();
      } catch (error) {
        console.error('Failed to connect Azguard wallet:', error);
      }
    }
  };

  const handleEmbeddedModalClose = () => {
    setIsEmbeddedModalOpen(false);
  };

  const handleEmbeddedWalletConnected = () => {
    setIsEmbeddedModalOpen(false);
    onWalletConnected?.();
  };

  const getDisplayData = () => {
    if (isEmbeddedConnected) return { value: WalletType.EMBEDDED, text: 'Embedded' };
    if (isAzguardConnected) return { value: WalletType.AZGUARD, text: 'Azguard' };
    return { value: 'wallet', text: 'Wallet' };
  };

  if (isAnyWalletConnected) {
    return null;
  }

  const displayData = getDisplayData();

  return (
    <>
      <div className="wallet-dropdown">
        <div className="wallet-select-wrapper">
          <select
            name="wallet-selector"
            value={displayData.value}
            onChange={handleWalletTypeChange}
            className="wallet-select"
            title="Select wallet type"
          >
            <option value="wallet" disabled>Wallet</option>
            <option value={WalletType.EMBEDDED}>Embedded</option>
            <option value={WalletType.AZGUARD}>Azguard</option>
          </select>
          <span className="wallet-select-arrow">▼</span>
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
