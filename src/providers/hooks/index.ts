// New hooks (using shared PXE architecture)
export { useSharedPXE } from './useSharedPXE';
export { useEmbeddedWallet } from './useEmbeddedWallet';
export { useExternalSignerWallet } from './useExternalSignerWallet';
export { useBrowserWallet } from './useBrowserWallet';
export { useEVMWalletInternal } from './useEVMWalletInternal';

// Network hook (unchanged)
export { useNetworkInternal } from './useNetworkInternal';

// Legacy hooks (for backwards compatibility during transition)
export { useEmbeddedWalletInternal } from './useEmbeddedWalletInternal';
export { useAzguardWalletInternal } from './useAzguardWalletInternal';

// Types from new hooks
export type {
  SharedPXEState,
  SharedPXEServices,
  SharedPXEActions,
  UseSharedPXEReturn,
} from './useSharedPXE';

export type {
  EmbeddedWalletState,
  EmbeddedWalletActions,
  EmbeddedWalletServices,
  UseEmbeddedWalletReturn,
} from './useEmbeddedWallet';

export type {
  ExternalSignerWalletState,
  ExternalSignerWalletActions,
  ExternalSignerWalletServices,
  UseExternalSignerWalletReturn,
} from './useExternalSignerWallet';

export type {
  BrowserWalletActions,
  UseBrowserWalletReturn,
} from './useBrowserWallet';

export type {
  EVMWalletState,
  EVMWalletActions,
  UseEVMWalletInternalReturn,
} from './useEVMWalletInternal';

// Types from legacy hooks (for backwards compatibility)
export type {
  EmbeddedWalletState as LegacyEmbeddedWalletState,
  EmbeddedWalletActions as LegacyEmbeddedWalletActions,
  EmbeddedWalletServices as LegacyEmbeddedWalletServices,
  UseEmbeddedWalletInternalReturn,
} from './useEmbeddedWalletInternal';

export type {
  AzguardWalletActions,
  UseAzguardWalletInternalReturn,
} from './useAzguardWalletInternal';

export type {
  NetworkState,
  NetworkActions,
  UseNetworkInternalReturn,
} from './useNetworkInternal';
