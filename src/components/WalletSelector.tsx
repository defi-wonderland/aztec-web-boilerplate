import React from 'react';
import { WalletDropdown } from './WalletDropdown';

interface WalletSelectorProps {
  onWalletConnected?: () => void;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ onWalletConnected }) => {
  return <WalletDropdown onWalletConnected={onWalletConnected} />;
};