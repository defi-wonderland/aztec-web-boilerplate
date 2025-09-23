import React, { useState } from 'react';
import { useAztecWallet, useAzguardWallet } from '../hooks';
import { EmbeddedWalletModal } from './EmbeddedWalletModal';

type WalletType = 'embedded' | 'azguard';

interface WalletDropdownProps {
  onWalletConnected?: () => void;
}

export const WalletDropdown: React.FC<WalletDropdownProps> = ({ onWalletConnected }) => {
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType>('embedded');
  const [isEmbeddedModalOpen, setIsEmbeddedModalOpen] = useState(false);
  
  const { connectedAccount } = useAztecWallet();
  const { state: azguardState, connect: connectAzguard } = useAzguardWallet();

  // Determine current wallet status
  const isEmbeddedConnected = !!connectedAccount;
  const isAzguardConnected = azguardState.isConnected;
  const isAnyWalletConnected = isEmbeddedConnected || isAzguardConnected;

  const handleWalletTypeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const walletType = event.target.value as WalletType;
    setSelectedWalletType(walletType);

    if (walletType === 'embedded') {
      setIsEmbeddedModalOpen(true);
    } else if (walletType === 'azguard') {
      try {
        await connectAzguard();
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

  // Get display data for the dropdown
  const getDisplayData = () => {
    if (isEmbeddedConnected) return { value: 'embedded', text: 'Embedded' };
    if (isAzguardConnected) return { value: 'azguard', text: 'Azguard' };
    return { value: 'wallet', text: 'Wallet' };
  };

  // Don't show dropdown if a wallet is already connected
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
            <option value="embedded">Embedded</option>
            <option value="azguard">Azguard</option>
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
