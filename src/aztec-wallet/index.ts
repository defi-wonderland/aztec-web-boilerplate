/**
 * AztecWallet - Modular wallet connection library for Aztec
 *
 * Simple usage - just add the provider and ConnectButton!
 * Modals and NetworkPicker are handled automatically.
 *
 * @example
 * ```tsx
 * import {
 *   AztecWalletProvider,
 *   createAztecWalletConfig,
 *   ConnectButton,
 * } from './aztec-wallet';
 *
 * const config = createAztecWalletConfig({
 *   networks: [{ name: 'devnet', nodeUrl: '...' }],
 *   showNetworkPicker: 'full', // or 'compact', or false to hide
 *   walletGroups: {
 *     embedded: { label: 'Use embedded account' },
 *     evmWallets: {
 *       wallets: [{ id: 'metamask', name: 'MetaMask', rdns: 'io.metamask' }],
 *     },
 *   },
 * });
 *
 * function App() {
 *   return (
 *     <AztecWalletProvider config={config}>
 *       <Header />
 *     </AztecWalletProvider>
 *   );
 * }
 *
 * function Header() {
 *   return (
 *     <nav>
 *       <ConnectButton />  // That's it! NetworkPicker included automatically
 *     </nav>
 *   );
 * }
 * ```
 */

// Provider
export {
  AztecWalletProvider,
  type AztecWalletProviderProps,
} from './providers';

// Config
export { createAztecWalletConfig } from './config';

// Hooks
export {
  useAztecWallet,
  useConnectModal,
  useNetworkModal,
  useAccountModal,
  useIsWalletInstalled,
  useDiscoveredWallets,
  useWalletsAvailability,
} from './hooks';

// Components
export {
  ConnectModal,
  ConnectButton,
  AccountModal,
  NetworkPicker,
  NetworkModal,
  Spinner,
  AddressDisplay,
  WalletButton,
  WalletGroupButton,
  BackButton,
  type ConnectModalProps,
  type ConnectButtonProps,
  type AccountModalProps,
  type NetworkPickerProps,
  type NetworkModalProps,
  type SpinnerProps,
  type AddressDisplayProps,
  type WalletButtonProps,
  type WalletGroupButtonProps,
  type BackButtonProps,
} from './components';

// Connectors
export {
  EmbeddedConnector,
  EMBEDDED_CONNECTOR_ID,
  createEmbeddedConnector,
  ExternalSignerConnector,
  BrowserWalletConnector,
  createConnectorRegistry,
  embedded,
  azguard,
  evmWallet,
  type ConnectorFactory,
  type ConnectorRegistryOptions,
} from './connectors';

// Types
export type {
  AztecWalletConfig,
  ResolvedAztecWalletConfig,
  NetworkPreset,
  WalletGroupsConfig,
  EmbeddedGroupConfig,
  AztecWalletsGroupConfig,
  AztecBrowserWalletConfig,
  EVMWalletsGroupConfig,
  EVMWalletConfig,
  NetworkPickerVariant,
  ModalView,
  ConnectionStatus,
  ConnectionState,
} from './types';

// Icons
export {
  MetaMaskIcon,
  RabbyIcon,
  AzguardIcon,
  WalletIconWrapper,
  getWalletIconSize,
  walletIconSizeMap,
  type WalletIconProps,
  type WalletIconWrapperProps,
  type WalletIconSize,
} from './assets/icons';

export type { WalletIconType } from './config/walletPresets';
