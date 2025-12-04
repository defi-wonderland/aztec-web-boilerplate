import React, { ReactNode, useMemo } from 'react';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { useConfig } from '../hooks/context/useConfig';
import { AztecContractProvider } from './AztecContractProvider';
import { aztecContracts, CORE_CONTRACTS, getContractsForConfig } from '../config/contracts';
import { WalletType } from '../types/aztec';

interface ContractProviderWrapperProps {
  children: ReactNode;
}

export const ContractProviderWrapper: React.FC<ContractProviderWrapperProps> = ({ children }) => {
  const { embedded, isInitialized, walletType } = useUniversalWallet();
  const { currentConfig } = useConfig();
  const networkContracts = useMemo(
    () => getContractsForConfig(currentConfig),
    [currentConfig]
  );

  // Only mount AztecContractProvider for embedded wallet
  // Azguard manages its own PXE and contract registration
  if (!isInitialized || !embedded.pxe || walletType !== WalletType.EMBEDDED) {
    return <>{children}</>;
  }

  return (
    <AztecContractProvider
      contracts={networkContracts}
      pxe={embedded.pxe}
      config={currentConfig}
      initialContracts={CORE_CONTRACTS}
    >
      {children}
    </AztecContractProvider>
  );
};
