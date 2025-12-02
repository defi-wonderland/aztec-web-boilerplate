import React, { ReactNode } from 'react';
import { useAztecWallet } from '../hooks/context/useAztecWallet';
import { useConfig } from '../hooks/context/useConfig';
import { AztecContractProvider } from './AztecContractProvider';
import { aztecContracts, CORE_CONTRACTS } from '../config/contracts';

interface ContractProviderWrapperProps {
  children: ReactNode;
}

export const ContractProviderWrapper: React.FC<ContractProviderWrapperProps> = ({ children }) => {
  const { pxe, isInitialized } = useAztecWallet();
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
