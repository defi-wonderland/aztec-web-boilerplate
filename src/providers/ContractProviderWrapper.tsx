import React, { ReactNode } from 'react';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { useConfig } from '../hooks/context/useConfig';
import { AztecContractProvider } from './AztecContractProvider';
import { aztecContracts, CORE_CONTRACTS } from '../config/contracts';

interface ContractProviderWrapperProps {
  children: ReactNode;
}

export const ContractProviderWrapper: React.FC<ContractProviderWrapperProps> = ({ children }) => {
  const { pxe, isInitialized } = useUniversalWallet();
  const { currentConfig } = useConfig();

  if (!isInitialized || !pxe) {
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
