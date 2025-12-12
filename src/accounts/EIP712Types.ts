import type { AuthWitnessProvider } from '@aztec/aztec.js/account';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Fr } from '@aztec/aztec.js/fields';

/**
 * Context for EIP-712 signing.
 * Contains the call metadata needed to construct the typed data message.
 */
export interface EIP712CallContext {
  /** Target contract address */
  targetContract: AztecAddress;
  /** Full function signature, e.g., "drip_to_private(Field,Field)" */
  functionSignature: string;
  /** Hash of function arguments */
  argsHash: Fr;
  /** Transaction nonce */
  nonce: Fr;
}

/**
 * Extended AuthWitnessProvider that supports EIP-712 typed data signing.
 * Call setCallContext() before createAuthWit() to provide transaction metadata.
 */
export interface EIP712AuthWitnessProvider extends AuthWitnessProvider {
  /**
   * Set the call context for the next createAuthWit call.
   * Must be called before createAuthWit().
   */
  setCallContext(context: EIP712CallContext): void;
}

/**
 * EIP-712 domain for Aztec transactions.
 */
export const EIP712_DOMAIN = {
  name: 'Aztec Account',
  version: '1',
} as const;

/**
 * EIP-712 type definitions for AztecTransaction.
 */
export const EIP712_TYPES = {
  AztecTransaction: [
    { name: 'outerHash', type: 'bytes32' },
    { name: 'targetContract', type: 'bytes32' },
    { name: 'functionSignature', type: 'string' },
    { name: 'argsHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

/**
 * Maximum length of function signature in bytes.
 * Supports signatures like "transfer_to_private(AztecAddress,AztecAddress,Field,Field)"
 */
export const MAX_FUNC_SIG_LEN = 128;

/**
 * Auth witness format (290 fields total):
 * [0-63]:    Signature (r + s, 64 bytes)
 * [64]:      Function signature length
 * [65-192]:  Function signature bytes (zero-padded to 128)
 * [193]:     Chain ID
 * [194-225]: Target contract (32 bytes)
 * [226-257]: Args hash (32 bytes)
 * [258-289]: Nonce (32 bytes)
 */
export const WITNESS_SIZE = 290;
