/**
 * Wallet Icons
 *
 * Pre-built SVG icon components for common wallets.
 * All icons accept a `size` prop (defaults to 24px) and standard SVG props.
 *
 * @example
 * ```tsx
 * import { MetaMaskIcon, RabbyIcon, AzguardIcon } from './aztec-wallet/assets/icons';
 *
 * // Basic usage
 * <MetaMaskIcon />
 *
 * // With custom size
 * <MetaMaskIcon size={32} />
 *
 * // With className
 * <MetaMaskIcon className="opacity-50" />
 * ```
 */

// Icon components
export { MetaMaskIcon } from './MetaMaskIcon';
export { RabbyIcon } from './RabbyIcon';
export { AzguardIcon } from './AzguardIcon';

// Wrapper utilities
export {
  WalletIconWrapper,
  getWalletIconSize,
  walletIconSizeMap,
  type WalletIconWrapperProps,
  type WalletIconSize,
} from './WalletIcon';

// Types
export type { WalletIconProps } from './types';
