import React, { ReactNode, useMemo } from 'react';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { AztecContractProvider } from './AztecContractProvider';
import { CORE_CONTRACTS, getContractsForConfig } from '../config/contracts';
import { isEmbeddedConnector } from '../types/walletConnector';

interface ContractProviderWrapperProps {
  children: ReactNode;
}

export const ContractProviderWrapper: React.FC<ContractProviderWrapperProps> = ({ children }) => {
  const { connector, isInitialized, currentConfig } = useUniversalWallet();
  const networkContracts = useMemo(
    () => getContractsForConfig(currentConfig),
    [currentConfig]
  );

  // Only mount AztecContractProvider for embedded connectors that expose local PXE
  const embeddedConnector = isEmbeddedConnector(connector) ? connector : null;
  const pxe = embeddedConnector?.getPXE() ?? null;

  if (!isInitialized || !embeddedConnector || !pxe) {
    return <>{children}</>;
  }

  return (
    <AztecContractProvider
      contracts={networkContracts}
      pxe={pxe}
      config={currentConfig}
      initialContracts={CORE_CONTRACTS}
    >
      {children}
    </AztecContractProvider>
  );
};
