/**
 * EVM-related type definitions
 *
 * Includes window.ethereum type declarations for injected wallet providers.
 */

import type { Hex } from 'viem';

/**
 * EIP-1193 Provider interface
 * @see https://eips.ethereum.org/EIPS/eip-1193
 */
export interface EIP1193Provider {
  /**
   * Submit a JSON-RPC request to the provider
   */
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;

  /**
   * Subscribe to provider events
   */
  on: (event: string, handler: (...args: unknown[]) => void) => void;

  /**
   * Unsubscribe from provider events
   */
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;

  /**
   * Whether MetaMask is the provider (MetaMask-specific)
   */
  isMetaMask?: boolean;
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

// Extend global Window interface
declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export {};
