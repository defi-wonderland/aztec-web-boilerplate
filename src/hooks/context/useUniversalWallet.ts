import { useCallback, useMemo } from 'react';
import {
  getEVMWalletService,
  type EVMWalletService,
} from '../../aztec-wallet/services/evm';
import {
  getEVMStore,
  useEVMAddress,
  useEVMAvailable,
} from '../../aztec-wallet/store/evm';
import {
  useCurrentNetwork,
  useNetworkActions,
  buildNetworkOptions,
  useNetworkStore,
} from '../../aztec-wallet/store/network';
import {
  useWalletActions,
  useWalletConnectors,
  useWalletView,
} from '../../aztec-wallet/store/wallet';
import { WalletType } from '../../types/aztec';
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

  isConnected: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  needsSigner: boolean;
  error: string | null;
  walletType: WalletType | null;

  account: ReturnType<typeof useWalletView>['account'];
  connector: ReturnType<typeof useWalletConnectors>[number] | null;
  connectors: ReturnType<typeof useWalletConnectors>;

  disconnect: () => Promise<void>;
  connectWith: (connectorId: string) => Promise<void>;
}

let cachedPresets: NetworkPreset[] = [];

/** @internal */
export const setNetworkPresets = (presets: NetworkPreset[]) => {
  cachedPresets = presets;
};

export const useUniversalWallet = (): UniversalWalletReturn => {
  const currentConfig = useCurrentNetwork();
  const { switchToNetwork, resetToDefault } = useNetworkActions();
  const configuredNetworks = useNetworkStore((s) => s.configuredNetworks);
  const connectors = useWalletConnectors();
  const { connect, disconnect } = useWalletActions();
  const {
    account,
    walletType,
    status,
    error,
    isPXEReady,
    activeConnectorId,
    connectingConnectorId,
  } = useWalletView();

  const evmAddress = useEVMAddress();
  const evmIsAvailable = useEVMAvailable();

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

  const activeConnector =
    connectors.find((candidate) => candidate.id === activeConnectorId) ?? null;

  const isConnected = activeConnector !== null && status === 'connected';
  const isInitialized = isPXEReady || walletType === WalletType.BROWSER_WALLET;
  const isLoading =
    status === 'connecting' ||
    status === 'deploying' ||
    connectingConnectorId !== null;
  const needsSigner =
    walletType === WalletType.EXTERNAL_SIGNER && evmAddress === null;

  const connectWith = useCallback(
    async (connectorId: string) => {
      await connect(connectorId);
    },
    [connect]
  );

  const handleDisconnect = useCallback(async () => {
    if (activeConnector) {
      await activeConnector.disconnect();
      return;
    }
    disconnect();
  }, [activeConnector, disconnect]);

  return {
    currentConfig,
    getNetworkOptions,
    switchToNetwork,
    resetToDefault,
    signer,
    isConnected,
    isInitialized,
    isLoading,
    needsSigner,
    error,
    walletType,
    account,
    connector: activeConnector,
    connectors,
    disconnect: handleDisconnect,
    connectWith,
  };
};
