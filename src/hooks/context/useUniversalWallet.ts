import { useCallback, useMemo } from 'react';
import { getEVMWalletService, type EVMWalletService } from '../../services/evm';
import { getEVMStore, useEVMAddress, useEVMAvailable } from '../../store/evm';
import {
  useCurrentNetwork,
  useNetworkActions,
  buildNetworkOptions,
  useNetworkStore,
} from '../../store/network';
import { WalletType } from '../../types/aztec';
import { useWalletContext } from './useWalletContext';
import type { NetworkPreset } from '../../sdk/walletKitConfig';
import type { Hex } from 'viem';

export interface UniversalWalletReturn {
  currentConfig: ReturnType<typeof useCurrentNetwork>;
  getNetworkOptions: () => ReturnType<typeof buildNetworkOptions>;
  switchToNetwork: (networkName: string) => boolean;
  resetToDefault: () => void;

  signer: {
    address: Hex | null;
    isAvailable: boolean;
    connect: (rdns?: string) => Promise<Hex | undefined>;
    disconnect: () => void;
    getService: () => EVMWalletService;
  };

  /** Whether a wallet is connected (has account) */
  isConnected: boolean;
  /** Whether the wallet is ready (PXE ready + connected for embedded, or browser wallet connected) */
  isInitialized: boolean;
  isLoading: boolean;
  needsSigner: boolean;
  error: string | null;
  walletType: WalletType | null;

  account: ReturnType<typeof useWalletContext>['account'];
  connector: ReturnType<typeof useWalletContext>['connector'];
  connectors: ReturnType<typeof useWalletContext>['connectors'];

  disconnect: () => Promise<void>;
  connectWith: ReturnType<typeof useWalletContext>['connect'];
}

let cachedPresets: NetworkPreset[] = [];

/** @internal */
export const setNetworkPresets = (presets: NetworkPreset[]) => {
  cachedPresets = presets;
};

export const useUniversalWallet = (): UniversalWalletReturn => {
  const context = useWalletContext();

  const currentConfig = useCurrentNetwork();
  const { switchToNetwork, resetToDefault } = useNetworkActions();
  const configuredNetworks = useNetworkStore((s) => s.configuredNetworks);

  const evmAddress = useEVMAddress();
  const evmIsAvailable = useEVMAvailable();

  // EVM connect/disconnect using service directly
  const evmConnect = useCallback(
    async (rdns?: string): Promise<Hex | undefined> => {
      const evmService = getEVMWalletService();
      getEVMStore().setConnecting(true);
      getEVMStore().setError(null);

      try {
        const address = await evmService.connect(undefined, rdns);
        getEVMStore().setAddress(address);
        return address;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to connect';
        getEVMStore().setError(message);
        return undefined;
      } finally {
        getEVMStore().setConnecting(false);
      }
    },
    []
  );

  const evmDisconnect = useCallback(() => {
    const evmService = getEVMWalletService();
    evmService.disconnect();
    getEVMStore().reset();
  }, []);

  const signer = useMemo(
    () => ({
      address: evmAddress,
      isAvailable: evmIsAvailable,
      connect: evmConnect,
      disconnect: evmDisconnect,
      getService: getEVMWalletService,
    }),
    [evmAddress, evmIsAvailable, evmConnect, evmDisconnect]
  );

  const getNetworkOptions = useMemo(
    () => () => buildNetworkOptions(configuredNetworks, cachedPresets),
    [configuredNetworks]
  );

  // Determine if external signer needs EVM connection
  const needsSigner =
    context.walletType === WalletType.EXTERNAL_SIGNER && evmAddress === null;

  return {
    currentConfig,
    getNetworkOptions,
    switchToNetwork,
    resetToDefault,
    signer,
    isConnected: context.isConnected,
    isInitialized: context.isInitialized,
    isLoading: context.isLoading,
    needsSigner,
    error: context.error,
    walletType: context.walletType,
    account: context.account,
    connector: context.connector,
    connectors: context.connectors,
    disconnect: context.disconnect,
    connectWith: context.connect,
  };
};
