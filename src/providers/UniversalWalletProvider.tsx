/**
 * Universal Wallet Provider
 *
 * Provides wallet context for all wallet types:
 * - EVM: MetaMask, Rabby, etc. (for external signing)
 * - Embedded: App PXE + internal signing
 * - External Signer: App PXE + external signing (MetaMask, etc.)
 * - Browser Wallet: External PXE (Azguard, Obsidian, etc.)
 */

import React, { createContext, ReactNode, useRef, useMemo } from 'react';
import type { Hex } from 'viem';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType, ExternalSignerType } from '../types/aztec';
import {
  useEmbeddedWallet,
  useExternalSignerWallet,
  useBrowserWallet,
  useNetworkInternal,
  useEVMWalletInternal,
} from './hooks';
import type {
  WalletConnector,
  WalletConnectorId,
} from '../types/walletConnector';
import {
  EmbeddedConnector,
  ExternalSignerConnector,
  BrowserWalletConnector,
} from '../connectors';
import { createAztecWalletKit, AztecWalletKit } from '../sdk/walletKit';
import type { WalletKitConfig } from '../sdk/walletKitConfig';
import type { NetworkConfig } from '../config/networks';
import { createEVMSigner } from '../signers';
import type { ExternalSigner } from '../signers/types';
import type { EVMWalletService } from '../services/evm/EVMWalletService';
import type { IBrowserWalletAdapter } from '../types/browserWallet';

export interface NetworkContextType {
  currentConfig: NetworkConfig;
  getNetworkOptions: () => Array<{
    value: string;
    label: string;
    description: string;
    disabled: boolean;
  }>;
  switchToNetwork: (networkName: string) => boolean;
  resetToDefault: () => void;
}

export interface SignerContextType {
  address: Hex | null;
  isAvailable: boolean;
  connect: () => Promise<Hex | undefined>;
  disconnect: () => void;
  getService: () => EVMWalletService;
}

export interface WalletContextType {
  isConnected: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  needsSigner: boolean;
  error: string | null;
  walletType: WalletType | null;
  account: AccountWithSecretKey | null;
  connector: WalletConnector | null;
  connectors: WalletConnector[];
  walletKit: AztecWalletKit;
  disconnect: () => Promise<void>;
  reinitialize: () => Promise<void>;
  connectWith: (connectorId: WalletConnectorId) => Promise<WalletConnector>;
}

// Combined context type
export interface UniversalWalletContextType
  extends NetworkContextType,
    WalletContextType {
  signer: SignerContextType;
}

export const UniversalWalletContext = createContext<
  UniversalWalletContextType | undefined
>(undefined);

interface UniversalWalletProviderProps {
  config: WalletKitConfig;
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<
  UniversalWalletProviderProps
> = ({ config: walletKitConfig, children }) => {
  const network = useNetworkInternal({
    networks: walletKitConfig.networks,
  });

  const evmWallet = useEVMWalletInternal();

  // Store signers by rdns for EIP-6963 multi-wallet support
  const signersRef = useRef<Map<string, ExternalSigner>>(new Map());
  const getSignerForConnector = (
    connector: ExternalSignerConnector
  ): ExternalSigner => {
    if (connector.signerType !== ExternalSignerType.EVM_WALLET) {
      throw new Error(`Unknown signer type: ${connector.signerType}`);
    }

    const key = connector.rdns ?? 'default';
    let signer = signersRef.current.get(key);
    if (!signer) {
      signer = createEVMSigner(evmWallet.service, connector.rdns);
      signersRef.current.set(key, signer);
    }
    return signer;
  };

  // Create wallet kit once
  const walletKitRef = useRef<AztecWalletKit | null>(null);
  if (!walletKitRef.current) {
    walletKitRef.current = createAztecWalletKit({
      aztecNode: network.state.currentConfig.nodeUrl,
      connectors: walletKitConfig.connectors,
    });
  }
  const walletKit = walletKitRef.current;
  const connectors = walletKit.getConnectors();

  // Find browser wallet connector and get its adapter (if any)
  const browserWalletAdapterRef = useRef<IBrowserWalletAdapter | null>(null);
  if (!browserWalletAdapterRef.current) {
    const browserConnector = connectors.find(
      (c): c is BrowserWalletConnector => c.type === WalletType.BROWSER_WALLET
    );
    if (browserConnector) {
      browserWalletAdapterRef.current = browserConnector.getAdapter();
    }
  }

  // Embedded wallet hook
  const embedded = useEmbeddedWallet({
    config: network.state.currentConfig,
    resetToDefault: network.actions.resetToDefault,
  });

  // External signer wallet hook
  const externalSigner = useExternalSignerWallet({
    config: network.state.currentConfig,
  });

  // Browser wallet hook (only if we have a browser wallet connector)
  const browserWalletAdapter = browserWalletAdapterRef.current;
  const browserWallet = useBrowserWallet(
    browserWalletAdapter
      ? { config: network.state.currentConfig, adapter: browserWalletAdapter }
      : { config: network.state.currentConfig, adapter: null as any }
  );

  // Update connector states
  for (const connector of connectors) {
    if (
      'updateState' in connector &&
      typeof connector.updateState === 'function'
    ) {
      if (connector.type === WalletType.EMBEDDED) {
        (connector as EmbeddedConnector).updateState(embedded);
      }
      if (connector.type === WalletType.EXTERNAL_SIGNER) {
        const extConnector = connector as ExternalSignerConnector;
        const signer = getSignerForConnector(extConnector);
        extConnector.updateState(externalSigner, signer);
      }
      if (
        connector.type === WalletType.BROWSER_WALLET &&
        browserWalletAdapter
      ) {
        (connector as BrowserWalletConnector).updateState(browserWallet);
      }
    }
  }

  // Find active connector
  const activeConnector = useMemo(() => {
    return (
      connectors.find((c) => {
        try {
          return c.getStatus().status === 'connected';
        } catch {
          return false;
        }
      }) ?? null
    );
  }, [
    connectors,
    embedded.state.embeddedAccount,
    externalSigner.state.aztecAccount,
    externalSigner.state.connectedRdns,
    browserWallet.state.status,
    browserWallet.accountWallet,
  ]);

  const activeAccount = activeConnector?.getAccount() ?? null;
  const activeWalletType = activeConnector?.type ?? null;

  // Check if External Signer wallet needs EVM signer to be connected
  const needsSigner =
    activeWalletType === WalletType.EXTERNAL_SIGNER &&
    !evmWallet.state.isConnected;

  // isConnected means "ready to use" - for External Signer, requires both Aztec + EVM connected
  const isConnected = activeConnector !== null && !needsSigner;

  // Determine initialization status based on any initialized wallet
  const isInitialized =
    embedded.state.isInitialized ||
    externalSigner.state.isInitialized ||
    browserWallet.state.isInstalled;

  const connectWith = async (
    connectorId: WalletConnectorId
  ): Promise<WalletConnector> => {
    if (activeConnector && activeConnector.id !== connectorId) {
      await activeConnector.disconnect();
    }
    return walletKit.connect(connectorId);
  };

  const handleDisconnect = async (): Promise<void> => {
    if (!activeConnector) return;
    await activeConnector.disconnect();
  };

  const handleReinitialize = async (): Promise<void> => {
    await embedded.actions.reinitialize();
  };

  // Compute loading state
  const isLoading =
    embedded.isLoading ||
    browserWallet.isLoading ||
    externalSigner.state.status === 'connecting' ||
    externalSigner.state.status === 'deploying' ||
    (activeWalletType === WalletType.EXTERNAL_SIGNER &&
      evmWallet.state.isConnecting);

  // Compute error state
  const walletError =
    embedded.error || browserWallet.error || externalSigner.error;
  const signerError =
    activeWalletType === WalletType.EXTERNAL_SIGNER
      ? evmWallet.state.error
      : null;
  const error = walletError || signerError;

  const contextValue: UniversalWalletContextType = {
    // Network context
    currentConfig: network.state.currentConfig,
    ...network.actions,

    // Signer context
    signer: {
      address: evmWallet.state.address,
      isAvailable: evmWallet.state.isAvailable,
      connect: evmWallet.actions.connect,
      disconnect: evmWallet.actions.disconnect,
      getService: () => evmWallet.service,
    },

    // Wallet context
    isConnected,
    isInitialized,
    isLoading,
    needsSigner,
    error,
    walletType: activeWalletType,
    account: activeAccount,
    connector: activeConnector,
    connectors,
    walletKit,
    disconnect: handleDisconnect,
    reinitialize: handleReinitialize,
    connectWith,
  };

  return (
    <UniversalWalletContext.Provider value={contextValue}>
      {children}
    </UniversalWalletContext.Provider>
  );
};
