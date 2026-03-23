/**
 * Wallet Icons
 *
 * Pre-built SVG icon components for common wallets.
 * All icons accept a `size` prop (defaults to 24px) and standard SVG props.
 *
 * @example
 * ```tsx
 * import { AzguardIcon } from './aztec-wallet/assets/icons';
 *
 * // Basic usage
 * <AzguardIcon />
 *
 * // With custom size
 * <AzguardIcon size={32} />
 *
 * // With className
 * <AzguardIcon className="opacity-50" />
 * ```
 */

// Icon components
export { AzguardIcon } from './AzguardIcon';
export { MetaMaskIcon } from './MetaMaskIcon';
export { RabbyIcon } from './RabbyIcon';

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
