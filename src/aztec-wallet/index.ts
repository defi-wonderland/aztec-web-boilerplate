/**
 * AztecWallet - Modular wallet connection library for Aztec
 *
 * A wagmi-like wallet connection library that handles the complexity of
 * connecting to Aztec wallets, managing PXE instances, and network switching.
 *
 * ## Quick Start
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
 *   networks: [{ name: 'devnet', nodeUrl: 'https://devnet.aztec.network' }],
 *   showNetworkPicker: 'full',
 *   walletGroups: {
 *     embedded: true,
 *     evmWallets: ['metamask', 'rabby'],
 *     aztecWallets: ['azguard'],
 *   },
 * });
 *
 * function App() {
 *   return (
 *     <AztecWalletProvider config={config}>
 *       <ConnectButton />
 *     </AztecWalletProvider>
 *   );
 * }
 * ```
 *
 * ## Wallet Types
 *
 * - **Embedded**: App manages PXE + internal signing (keys in localStorage)
 * - **External Signer**: App manages PXE + external signing (MetaMask, Rabby)
 * - **Browser Wallet**: Extension manages everything (Azguard)
 *
 * ## Deep Imports
 *
 * Internal modules (stores, services, connector classes) are available via
 * deep imports for advanced use cases, but these are not part of the stable
 * public API and may change without notice:
 *
 * ```ts
 * // ⚠️ Use at your own risk - not part of stable API
 * import { getWalletStore } from './aztec-wallet/store/wallet';
 * import { SharedPXEService } from './aztec-wallet/services/aztec/pxe';
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * Main provider component that wraps your app and provides wallet context.
 *
 * @example
 * ```tsx
 * <AztecWalletProvider config={config}>
 *   <App />
 * </AztecWalletProvider>
 * ```
 */
export {
  AztecWalletProvider,
  type AztecWalletProviderProps,
} from './providers';

// =============================================================================
// CONFIG
// =============================================================================

/**
 * Creates an AztecWallet configuration object.
 *
 * @example
 * ```ts
 * const config = createAztecWalletConfig({
 *   networks: [{ name: 'devnet', nodeUrl: 'https://devnet.aztec.network' }],
 *   walletGroups: {
 *     embedded: true,
 *     evmWallets: ['metamask'],
 *   },
 * });
 * ```
 */
export { createAztecWalletConfig } from './config';

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main hook for accessing wallet state and actions.
 * Provides connection status, account data, network info, and wallet actions.
 */
export { useAztecWallet } from './hooks';

/**
 * Hook to control the connect modal programmatically.
 * Use when building custom connect UI instead of ConnectButton.
 */
export { useConnectModal } from './hooks';

/**
 * Hook to control the account modal programmatically.
 * Use when building custom account management UI.
 */
export { useAccountModal } from './hooks';

/**
 * Hook to control the network modal programmatically.
 * Use when building custom network switching UI.
 */
export { useNetworkModal } from './hooks';

/**
 * Hook to check if a specific EVM wallet is installed/available.
 */
export { useIsEvmWalletInstalled } from './hooks';

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * All-in-one connect button that handles connection flow automatically.
 * Includes network picker when configured via `showNetworkPicker` option.
 */
export { ConnectButton, type ConnectButtonProps } from './components';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Main configuration type for AztecWallet.
 */
export type { AztecWalletConfig } from './types';

/**
 * Network preset configuration for defining available networks.
 */
export type { NetworkPreset } from './types';

/**
 * Wallet groups configuration for organizing wallet options.
 */
export type { WalletGroupsConfig } from './types';

/**
 * Connection status enum: 'disconnected' | 'connecting' | 'connected' | 'error'
 */
export type { ConnectionStatus } from './types';

/**
 * Wallet type enum for different wallet implementations.
 */
export { WalletType, ExternalSignerType } from './types/aztec';

/**
 * Base interface for wallet connectors.
 * Use for building custom connectors or advanced type checking.
 */
export type {
  WalletConnector,
  WalletConnectorId,
} from '../types/walletConnector';

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a connector is an embedded wallet connector.
 *
 * @example
 * ```ts
 * if (isEmbeddedConnector(connector)) {
 *   const pxe = connector.getPXE();
 * }
 * ```
 */
export { isEmbeddedConnector } from '../types/walletConnector';

/**
 * Type guard to check if a connector is an external signer connector (EVM wallet).
 *
 * @example
 * ```ts
 * if (isExternalSignerConnector(connector)) {
 *   const pxe = connector.getPXE();
 * }
 * ```
 */
export { isExternalSignerConnector } from '../types/walletConnector';

/**
 * Type guard to check if a connector is a browser wallet connector (Azguard).
 *
 * @example
 * ```ts
 * if (isBrowserWalletConnector(connector)) {
 *   const caipAccount = connector.getCaipAccount();
 * }
 * ```
 */
export { isBrowserWalletConnector } from '../types/walletConnector';

/**
 * Type guard to check if a connector has app-managed PXE.
 * Returns true for embedded and external signer connectors.
 *
 * @example
 * ```ts
 * if (hasAppManagedPXE(connector)) {
 *   const pxe = connector.getPXE();
 *   const wallet = connector.getWallet();
 * }
 * ```
 */
export { hasAppManagedPXE } from '../types/walletConnector';
