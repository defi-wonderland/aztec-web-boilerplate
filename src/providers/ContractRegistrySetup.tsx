import React, { useMemo, type ReactNode } from 'react';
import { CloudDownload, Globe, HardDrive, RefreshCw, Zap } from 'lucide-react';
import { useAztecWallet, WalletType } from '@aztec-wallet';
import {
  ContractRegistryProvider,
  type ContractConfigMap,
  type ContractRegistryWalletAdapter,
  useArtifactLoader,
} from '@contract-registry';
import { contractsConfig } from '../config/contracts';
import { useToast } from '../hooks';
import { queuePxeCall, iconSize } from '../utils';

// Hoist the cast outside the component so the reference is stable across renders
const typedContractsConfig = contractsConfig as unknown as ContractConfigMap;

const SOURCE_TOAST_MAP: Record<
  string,
  { description: string; icon: React.ReactNode }
> = {
  local: {
    description: 'Using bundled artifacts',
    icon: <HardDrive size={iconSize('md')} />,
  },
  registry: {
    description: 'Loaded from artifact registry',
    icon: <CloudDownload size={iconSize('md')} />,
  },
  external: {
    description: 'Loaded from external package',
    icon: <Globe size={iconSize('md')} />,
  },
  cached: {
    description: 'Loaded from cache',
    icon: <Zap size={iconSize('md')} />,
  },
};

const DEFAULT_TOAST_CONFIG = {
  description: 'Artifacts loaded',
  icon: <CloudDownload size={iconSize('md')} />,
};

function getSourceToastConfig(sourceLabel: string) {
  return SOURCE_TOAST_MAP[sourceLabel] ?? DEFAULT_TOAST_CONFIG;
}

interface ContractRegistrySetupProps {
  children: ReactNode;
}

export function ContractRegistrySetup({
  children,
}: ContractRegistrySetupProps): React.ReactElement {
  const w = useAztecWallet();
  const { addToast } = useToast();
  const { artifacts } = useArtifactLoader({
    networkConfig: w.currentConfig,
    contractsConfig: typedContractsConfig,
    onLoaded: (result) => {
      if (result.sourceLabel !== 'local') {
        const toastConfig = getSourceToastConfig(result.sourceLabel);
        addToast({
          title: `Artifacts loaded in ${result.elapsedMs.toFixed(0)}ms`,
          description: toastConfig.description,
          variant: 'info',
          icon: toastConfig.icon,
          duration: 5000,
        });
      }
    },
    onError: (error) => {
      addToast({
        title: 'Failed to load contract artifacts',
        description: error.message,
        variant: 'error',
        duration: 10000,
      });
    },
  });

  const walletAdapter = useMemo<ContractRegistryWalletAdapter>(
    () => ({
      isConnected: w.isConnected,
      isPXEInitialized: w.isPXEInitialized,
      account: w.account,
      walletType: w.walletType,
      isBrowserWallet: w.walletType === WalletType.BROWSER_WALLET,
      currentConfig: w.currentConfig,
      getPXE: w.getPXE,
      getWallet: w.getWallet,
      queuePxeCall,
    }),
    [
      w.isConnected,
      w.isPXEInitialized,
      w.account,
      w.walletType,
      w.currentConfig,
      w.getPXE,
      w.getWallet,
    ]
  );

  return (
    <ContractRegistryProvider
      wallet={walletAdapter}
      contracts={typedContractsConfig}
      artifacts={artifacts}
      onReady={({ contractCount, elapsedMs, cached }) => {
        if (contractCount > 0) {
          const labelSuffix = contractCount === 1 ? '' : 's';
          const sourceText = cached ? 'Cached in PXE' : 'Fresh registration';
          const icon = cached ? (
            <Zap size={iconSize('md')} />
          ) : (
            <RefreshCw size={iconSize('md')} />
          );

          addToast({
            title: `Contracts loaded in ${elapsedMs.toFixed(0)}ms`,
            description: `${contractCount} contract${labelSuffix} \u2022 ${sourceText}`,
            variant: 'info',
            icon,
            duration: 8000,
          });
        }
      }}
      onError={(error) => {
        addToast({
          title: 'Contract registration failed',
          description: error.message,
          variant: 'error',
          duration: 10000,
        });
      }}
    >
      {children}
    </ContractRegistryProvider>
  );
}
