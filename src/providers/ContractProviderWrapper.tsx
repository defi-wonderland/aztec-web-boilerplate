import React, { ReactNode, useMemo } from 'react';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { AztecContractProvider } from './AztecContractProvider';
import { CORE_CONTRACTS, getContractsForConfig } from '../config/contracts';
import { WalletType } from '../types/aztec';

interface ContractProviderWrapperProps {
  children: ReactNode;
}

export const ContractProviderWrapper: React.FC<ContractProviderWrapperProps> = ({ children }) => {
  const { connector, isInitialized, walletType, currentConfig } = useUniversalWallet();
  const networkContracts = useMemo(
    () => getContractsForConfig(currentConfig),
    [currentConfig]
  );

  // Mount AztecContractProvider for embedded and MetaMask wallets
  // Azguard manages its own PXE and contract registration
  const pxe = connector?.getPXE?.() ?? null;
  const supportsLocalPXE = walletType === WalletType.EMBEDDED || walletType === WalletType.METAMASK;

  if (!isInitialized || !pxe || !supportsLocalPXE) {
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
