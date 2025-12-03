import React, { ReactNode } from 'react';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { useConfig } from '../hooks/context/useConfig';
import { AztecContractProvider } from './AztecContractProvider';
import { aztecContracts, CORE_CONTRACTS } from '../config/contracts';
import { WalletType } from '../types/aztec';

interface ContractProviderWrapperProps {
  children: ReactNode;
}

export const ContractProviderWrapper: React.FC<ContractProviderWrapperProps> = ({ children }) => {
  const { pxe, isInitialized, walletType } = useUniversalWallet();
  const { currentConfig } = useConfig();

  // Only mount AztecContractProvider for embedded wallet
  // Azguard manages its own PXE and contract registration
  if (!isInitialized || !pxe || walletType !== WalletType.EMBEDDED) {
    return <>{children}</>;
  }

  return (
    <AztecContractProvider
      contracts={aztecContracts}
      pxe={pxe}
      config={currentConfig}
      initialContracts={CORE_CONTRACTS}
    >
      {children}
    </AztecContractProvider>
  );
};
