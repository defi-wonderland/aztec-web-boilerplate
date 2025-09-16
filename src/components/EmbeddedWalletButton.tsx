import React, { useState } from 'react';
import { EmbeddedWalletModal } from './EmbeddedWalletModal';

interface EmbeddedWalletButtonProps {
  onWalletConnected?: () => void;
}

export const EmbeddedWalletButton: React.FC<EmbeddedWalletButtonProps> = ({ onWalletConnected }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="embedded-wallet-button"
        type="button"
      >
        <span>Embedded Wallet</span>
      </button>
      
      <EmbeddedWalletModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onWalletConnected={onWalletConnected}
      />
    </>
  );
};
