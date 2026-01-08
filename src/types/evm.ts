/**
 * EVM-related type definitions
 *
 * Includes window.ethereum and EIP-6963 type declarations.
 */

import type { Hex } from 'viem';

/**
 * EIP-1193 Provider interface
 * @see https://eips.ethereum.org/EIPS/eip-1193
 */
export interface EIP1193Provider {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
}

/**
 * EIP-6963 Provider Info
 * @see https://eips.ethereum.org/EIPS/eip-6963
 */
export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

/**
 * EIP-6963 Provider Detail (from announceProvider event)
 */
export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

/**
 * EIP-6963 Announce Provider Event
 */
export interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: 'eip6963:announceProvider';
  detail: EIP6963ProviderDetail;
}

/**
 * Common EVM wallet events
 */
export type EVMWalletEvent =
  | 'accountsChanged'
  | 'chainChanged'
  | 'connect'
  | 'disconnect'
  | 'message';

/**
 * EVM address type (0x-prefixed hex string)
 */
export type EVMAddress = Hex;

/**
 * EVM chain ID
 */
export type EVMChainId = number;

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
  interface WindowEventMap {
    'eip6963:announceProvider': EIP6963AnnounceProviderEvent;
  }
}

export {};
