/**
 * EIP-712 Clear Signing for MetaMask
 *
 * This module builds EIP-712 typed data structures that display
 * individual function arguments in MetaMask instead of opaque hashes.
 */

import type { Hex } from 'viem';
import { keccak256, toHex, pad } from 'viem';

// Capsule storage slots (must match Noir contract)
export const EIP712_WITNESS_SLOT = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
export const EIP712_WITNESS_5_SLOT = 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321n;

/**
 * EIP-712 type definitions for clear signing
 */
export const EIP712_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ],
  FunctionCall: [
    { name: 'contract', type: 'bytes32' },
    { name: 'functionSignature', type: 'string' },
    { name: 'arguments', type: 'uint256[]' },
  ],
  AppDomain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
  ],
  EntrypointAuthorization: [
    { name: 'appDomain', type: 'AppDomain' },
    { name: 'functionCall', type: 'FunctionCall' },
    { name: 'txNonce', type: 'uint256' },
  ],
  EntrypointAuthorization5: [
    { name: 'appDomain', type: 'AppDomain' },
    { name: 'functionCalls', type: 'FunctionCall[5]' },
    { name: 'txNonce', type: 'uint256' },
  ],
};

/**
 * Default app domain values
 */
export const APP_DOMAIN = {
  name: 'EVM Aztec Wallet',
  version: '1.0.0',
  salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
};

export interface FunctionCallInput {
  targetAddress: Hex;
  functionSignature: string;
  args: bigint[];
}

export interface BuildTypedDataInput {
  targetAddress: Hex;
  functionSignature: string;
  args: bigint[];
  chainId: bigint;
  txNonce: bigint;
}

export interface BuildTypedData5Input {
  calls: FunctionCallInput[];
  chainId: bigint;
  txNonce: bigint;
}

/**
 * Build EIP-712 typed data for a single function call.
 * This structure displays individual arguments in MetaMask.
 */
export function buildTypedDataForMetaMask(input: BuildTypedDataInput) {
  const { targetAddress, functionSignature, args, chainId, txNonce } = input;

  // Pad target address to 32 bytes
  const contractBytes32 = pad(targetAddress as Hex, { size: 32 });

  return {
    domain: {
      name: 'Aztec',
      version: '1',
      chainId,
    },
    types: {
      ...EIP712_TYPES,
    },
    primaryType: 'EntrypointAuthorization' as const,
    message: {
      appDomain: {
        name: APP_DOMAIN.name,
        version: APP_DOMAIN.version,
        chainId,
        salt: APP_DOMAIN.salt,
      },
      functionCall: {
        contract: contractBytes32,
        functionSignature,
        arguments: args, // Individual args - NOT hashed!
      },
      txNonce,
    },
  };
}

/**
 * Build EIP-712 typed data for 5 function calls (batch).
 * Pads with empty calls if fewer than 5 are provided.
 *
 * Note: EIP-712 doesn't support fixed-length arrays directly.
 * We encode as 5 separate fields: call0, call1, call2, call3, call4
 */
export function buildTypedDataForMetaMask5(input: BuildTypedData5Input) {
  const { calls, chainId, txNonce } = input;

  // Pad to 5 calls
  const paddedCalls: FunctionCallInput[] = [...calls];
  while (paddedCalls.length < 5) {
    paddedCalls.push({
      targetAddress: '0x0000000000000000000000000000000000000000' as Hex,
      functionSignature: '',
      args: [],
    });
  }

  // Convert to typed data format - as individual fields
  const functionCallsTyped = paddedCalls.map((call) => ({
    contract: pad(call.targetAddress as Hex, { size: 32 }),
    functionSignature: call.functionSignature,
    arguments: call.args,
  }));

  return {
    domain: {
      name: 'Aztec',
      version: '1',
      chainId,
    },
    types: {
      EIP712Domain: EIP712_TYPES.EIP712Domain,
      FunctionCall: EIP712_TYPES.FunctionCall,
      AppDomain: EIP712_TYPES.AppDomain,
      // Use individual call fields instead of array
      EntrypointAuthorization5: [
        { name: 'appDomain', type: 'AppDomain' },
        { name: 'call0', type: 'FunctionCall' },
        { name: 'call1', type: 'FunctionCall' },
        { name: 'call2', type: 'FunctionCall' },
        { name: 'call3', type: 'FunctionCall' },
        { name: 'call4', type: 'FunctionCall' },
        { name: 'txNonce', type: 'uint256' },
      ],
    },
    primaryType: 'EntrypointAuthorization5' as const,
    message: {
      appDomain: {
        name: APP_DOMAIN.name,
        version: APP_DOMAIN.version,
        chainId,
        salt: APP_DOMAIN.salt,
      },
      call0: functionCallsTyped[0],
      call1: functionCallsTyped[1],
      call2: functionCallsTyped[2],
      call3: functionCallsTyped[3],
      call4: functionCallsTyped[4],
      txNonce,
    },
    // Also expose as array for easier access
    functionCalls: functionCallsTyped,
  };
}

/**
 * Compute the domain separator hash
 */
export function computeDomainSeparator(chainId: bigint): Uint8Array {
  const domainTypeHash = keccak256(
    new TextEncoder().encode('EIP712Domain(string name,string version,uint256 chainId)')
  );

  const nameHash = keccak256(new TextEncoder().encode('Aztec'));
  const versionHash = keccak256(new TextEncoder().encode('1'));

  // Encode: typeHash || nameHash || versionHash || chainId
  const encoded = new Uint8Array(128);
  encoded.set(hexToBytes(domainTypeHash), 0);
  encoded.set(hexToBytes(nameHash), 32);
  encoded.set(hexToBytes(versionHash), 64);
  encoded.set(bigintToBytes32(chainId), 96);

  const hashHex = keccak256(encoded);
  return hexToBytes(hashHex);
}

/**
 * Helper: Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Helper: Convert bigint to 32-byte array (big-endian)
 */
function bigintToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return hexToBytes(hex);
}
