/**
 * EIP-712 Types for Aztec Authwits
 * Reference: /aztec-712/docs/EIP-712 authwits spec
 */

import type { Hex } from 'viem';

// =============================================================================
// Entrypoint Authorization (spec lines 138-161)
// =============================================================================

/**
 * Function call representation for EIP-712
 * The `arguments` array IS the pre-image of args_hash - this is what makes it human-readable!
 */
export interface FunctionCall {
  contract: Hex;              // bytes32 - target_address as 32 bytes
  functionSignature: string;  // Full signature e.g. "transfer_private(Field,Field,u128,Field)"
  arguments: bigint[];        // uint256[] - serialized args (THE PRE-IMAGE!)
}

/**
 * App domain separator nested within the message
 * Name and version are hardcoded in the account contract
 */
export interface AppDomain {
  name: string;       // "EVM Aztec Wallet" - hardcoded in contract
  version: string;    // "1.0.0" - hardcoded in contract
  chainId: bigint;    // Aztec chain ID
  salt: Hex;          // 32 bytes, account-specific
}

/**
 * Entrypoint authorization message (single call - legacy)
 * Authorizes a single function call (simplified)
 */
export interface EntrypointAuthorization {
  appDomain: AppDomain;
  functionCall: FunctionCall;
  txNonce: bigint;
}

/**
 * Entrypoint authorization message (5 calls - new)
 * Authorizes up to 5 function calls in a single transaction
 */
export interface EntrypointAuthorization5 {
  appDomain: AppDomain;
  functionCalls: FunctionCall[];  // Array of 5 (padded with EMPTY_FUNCTION_CALL)
  txNonce: bigint;
}

// =============================================================================
// Individual Authwit Authorization (spec lines 221-244)
// =============================================================================

/**
 * App domain for individual authwits
 * NOTE: no name/version since the consumer contract is unknown at compile time
 */
export interface AuthwitAppDomain {
  chainId: bigint;
  verifyingContract: Hex;  // Consumer contract address (who called assert_current_call_valid_authwit)
}

/**
 * Individual function call authorization
 * Used when a contract calls assert_current_call_valid_authwit
 */
export interface FunctionCallAuthorization {
  appDomain: AuthwitAppDomain;
  functionCall: FunctionCall;
}

// =============================================================================
// EIP-712 Type Definitions
// =============================================================================

export const ACCOUNT_MAX_CALLS = 5;  // 5 function calls per entrypoint (per Aztec AppPayload spec)

/**
 * EIP-712 type definitions for viem/ethers (single function call - legacy)
 */
export const EIP712_TYPES = {
  // Outer domain (Aztec rollup level)
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ],

  // App domain (account contract level)
  AppDomain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
  ],

  // Function call with visible arguments
  FunctionCall: [
    { name: 'contract', type: 'bytes32' },
    { name: 'functionSignature', type: 'string' },
    { name: 'arguments', type: 'uint256[]' },
  ],

  // Entrypoint authorization (single function call, simplified)
  EntrypointAuthorization: [
    { name: 'appDomain', type: 'AppDomain' },
    { name: 'functionCall', type: 'FunctionCall' },
    { name: 'txNonce', type: 'uint256' },
  ],

  // For individual authwits
  AuthwitAppDomain: [
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'bytes32' },
  ],

  FunctionCallAuthorization: [
    { name: 'appDomain', type: 'AuthwitAppDomain' },
    { name: 'functionCall', type: 'FunctionCall' },
  ],
} as const;

/**
 * EIP-712 type definitions for 5 function calls (new)
 * Uses FunctionCall[5] instead of a single FunctionCall
 */
export const EIP712_TYPES_5 = {
  // Outer domain (Aztec rollup level) - includes verifyingContract
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],

  // App domain (account contract level)
  AppDomain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
  ],

  // Function call with visible arguments
  FunctionCall: [
    { name: 'contract', type: 'bytes32' },
    { name: 'functionSignature', type: 'string' },
    { name: 'arguments', type: 'uint256[]' },
  ],

  // Entrypoint authorization (5 function calls)
  EntrypointAuthorization: [
    { name: 'appDomain', type: 'AppDomain' },
    { name: 'functionCalls', type: 'FunctionCall[5]' },
    { name: 'txNonce', type: 'uint256' },
  ],

  // For individual authwits
  AuthwitAppDomain: [
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'bytes32' },
  ],

  FunctionCallAuthorization: [
    { name: 'appDomain', type: 'AuthwitAppDomain' },
    { name: 'functionCall', type: 'FunctionCall' },
  ],
} as const;

/**
 * Empty function call (for unused slots in entrypoint)
 */
export const EMPTY_FUNCTION_CALL: FunctionCall = {
  contract: '0x0000000000000000000000000000000000000000000000000000000000000000',
  functionSignature: '',
  arguments: [],
};

// =============================================================================
// Capsule Slot Constants (must match Noir eip712.nr)
// =============================================================================

/** Capsule slot for single-call witness (legacy) */
export const EIP712_WITNESS_SLOT = 0x1234567890abcdefn;

/** Capsule slot for 5-call witness (new) */
export const EIP712_WITNESS_5_SLOT = 0x1234567890abcdf0n;

/** Capsule slot for individual authwit */
export const EIP712_AUTHWIT_SLOT = 0xabcdef1234567890n;

// =============================================================================
// Serialization Size Constants (must match Noir eip712.nr)
// =============================================================================

/** Max function arguments */
export const MAX_SERIALIZED_ARGS = 20;

/** Max function signature string length */
export const MAX_SIGNATURE_SIZE = 128;

/** Serialized size of Eip712Witness (single call) in Fields */
export const EIP712_WITNESS_SERIALIZED_LEN = 33;

/** Serialized size of Eip712Witness5 (5 calls) in Fields */
export const EIP712_WITNESS_5_SERIALIZED_LEN = 145;

/** Serialized size of Eip712AuthwitWitness in Fields */
export const EIP712_AUTHWIT_SERIALIZED_LEN = 34;

// =============================================================================
// Default verifying contract (sandbox rollup address)
// =============================================================================

/**
 * Default verifying contract address for sandbox
 * This is a placeholder - in production, fetch dynamically via node.getL1ContractAddresses().rollupAddress
 */
export const DEFAULT_VERIFYING_CONTRACT = '0x0000000000000000000000000000000000000001' as const;
