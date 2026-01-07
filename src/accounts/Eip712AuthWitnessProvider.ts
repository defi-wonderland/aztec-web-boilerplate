/**
 * EIP-712 Auth Witness Provider
 *
 * Uses MetaMask's signTypedData to create human-readable auth witnesses
 * where users can see individual function arguments before signing.
 */

import type { AuthWitnessProvider } from '@aztec/aztec.js/account';
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import type { WalletClient, Hex } from 'viem';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';

import {
  buildTypedDataForMetaMask,
  buildTypedDataForMetaMask5,
  computeDomainSeparator,
  EIP712_WITNESS_SLOT,
  EIP712_WITNESS_5_SLOT,
  type FunctionCallInput,
} from '../lib/eip712-clear-signing';

/**
 * Simple capsule interface for witness data
 */
export interface CapsuleData {
  contractAddress: AztecAddress;
  slot: Fr;
  fields: Fr[];
}

export interface EntrypointInput {
  targetAddress: Hex;
  functionSignature: string;
  args: bigint[];
  txNonce: bigint;
}

export interface Entrypoint5Input {
  calls: FunctionCallInput[];
  txNonce: bigint;
}

export interface AuthWitResult {
  signature: {
    r: Uint8Array;
    s: Uint8Array;
  };
  capsuleFields: (bigint | Fr)[];
  messageHash: Uint8Array;
  targetAddress: string;
  functionSignature: string;
  args: bigint[];
}

export interface AuthWit5Result {
  signature: {
    r: Uint8Array;
    s: Uint8Array;
  };
  capsuleFields: (bigint | Fr)[];
  calls: FunctionCallInput[];
}

/**
 * Auth witness provider that uses EIP-712 signTypedData for clear signing.
 *
 * Unlike MetaMaskAuthWitnessProvider which shows opaque hashes,
 * this provider displays human-readable function arguments in MetaMask.
 *
 * This class implements AuthWitnessProvider for compatibility with the
 * Aztec SDK, while also providing clear signing methods for entrypoint calls.
 */
export class Eip712AuthWitnessProvider implements AuthWitnessProvider {
  private readonly walletClient: WalletClient;
  private readonly account: Hex;
  public readonly chainId: bigint;

  constructor(walletClient: WalletClient, account: Hex, chainId: bigint) {
    this.walletClient = walletClient;
    this.account = account;
    this.chainId = chainId;
  }

  /**
   * Create an auth witness for a message hash (standard AuthWitnessProvider interface).
   *
   * This method provides backwards compatibility with the standard Aztec SDK flow.
   * For clear signing with human-readable arguments, use createAuthWitForEntrypoint instead.
   *
   * @param messageHash - The outer_hash from Aztec (Poseidon hash of the action)
   * @returns AuthWitness containing the signature fields
   */
  async createAuthWit(messageHash: Fr): Promise<AuthWitness> {
    // Convert Fr to 32-byte buffer for signing
    const messageBytes = messageHash.toBuffer();

    // For standard authwits, we sign the hash using personal_sign
    // (fallback behavior when structured data isn't available)
    const signature = await this.walletClient.signMessage!({
      account: this.account,
      message: { raw: messageBytes },
    });

    // Parse the signature (65 bytes: r[32] + s[32] + v[1])
    const sigHex = signature.slice(2);
    const r = Buffer.from(sigHex.slice(0, 64), 'hex');
    const s = Buffer.from(sigHex.slice(64, 128), 'hex');

    // Convert signature bytes to Field array (64 fields, one per byte)
    const witnessFields: Fr[] = [];
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(r[i]));
    }
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(s[i]));
    }

    return new AuthWitness(messageHash, witnessFields);
  }

  /**
   * Compute the EIP-712 domain separator
   */
  computeDomainSeparator(): Uint8Array {
    return computeDomainSeparator(this.chainId);
  }

  /**
   * Create auth witness for a single function call entrypoint.
   * Uses signTypedData to show individual arguments in MetaMask.
   */
  async createAuthWitForEntrypoint(input: EntrypointInput): Promise<AuthWitResult> {
    const { targetAddress, functionSignature, args, txNonce } = input;

    // Build typed data that shows individual args
    const typedData = buildTypedDataForMetaMask({
      targetAddress,
      functionSignature,
      args,
      chainId: this.chainId,
      txNonce,
    });

    // Sign with MetaMask - user sees readable data!
    const signature = await this.signTypedData(typedData);

    // Parse signature
    const { r, s } = this.parseSignature(signature);

    // Serialize for capsule
    const capsuleFields = this.serializeWitness({
      r,
      s,
      targetAddress,
      functionSignature,
      args,
      chainId: this.chainId,
      txNonce,
    });

    // Compute message hash (for reference)
    const messageHash = this.computeDomainSeparator(); // Simplified

    return {
      signature: { r, s },
      capsuleFields,
      messageHash,
      targetAddress,
      functionSignature,
      args,
    };
  }

  /**
   * Create auth witness for 5-call batch entrypoint.
   */
  async createAuthWitForEntrypoint5(input: Entrypoint5Input): Promise<AuthWit5Result> {
    const { calls, txNonce } = input;

    // Pad to 5 calls
    const paddedCalls: FunctionCallInput[] = [...calls];
    while (paddedCalls.length < 5) {
      paddedCalls.push({
        targetAddress: '0x0000000000000000000000000000000000000000' as Hex,
        functionSignature: '',
        args: [],
      });
    }

    // Build typed data for 5 calls
    const typedData = buildTypedDataForMetaMask5({
      calls: paddedCalls,
      chainId: this.chainId,
      txNonce,
    });

    // Sign with MetaMask
    const signature = await this.signTypedData(typedData);

    // Parse signature
    const { r, s } = this.parseSignature(signature);

    // Serialize for capsule
    const capsuleFields = this.serializeWitness5({
      r,
      s,
      calls: paddedCalls,
      chainId: this.chainId,
      txNonce,
    });

    return {
      signature: { r, s },
      capsuleFields,
      calls: paddedCalls,
    };
  }

  /**
   * Create a Capsule for the Noir contract
   */
  async createCapsule(
    contractAddress: AztecAddress,
    input: EntrypointInput
  ): Promise<CapsuleData> {
    const result = await this.createAuthWitForEntrypoint(input);

    return {
      contractAddress,
      slot: new Fr(EIP712_WITNESS_SLOT),
      fields: result.capsuleFields.map((f) => (f instanceof Fr ? f : new Fr(f))),
    };
  }

  /**
   * Create a Capsule for 5-call batch
   */
  async createCapsule5(
    contractAddress: AztecAddress,
    input: Entrypoint5Input
  ): Promise<CapsuleData> {
    const result = await this.createAuthWitForEntrypoint5(input);

    return {
      contractAddress,
      slot: new Fr(EIP712_WITNESS_5_SLOT),
      fields: result.capsuleFields.map((f) => (f instanceof Fr ? f : new Fr(f))),
    };
  }

  /**
   * Sign typed data using wallet client.
   *
   * Accepts both single-call and 5-call typed data formats.
   */
  private async signTypedData(
    typedData: ReturnType<typeof buildTypedDataForMetaMask> | ReturnType<typeof buildTypedDataForMetaMask5>
  ): Promise<Hex> {
    if (!this.walletClient.signTypedData) {
      throw new Error('Wallet client does not support signTypedData. EIP-712 clear signing requires signTypedData support.');
    }

    return await this.walletClient.signTypedData({
      account: this.account,
      domain: typedData.domain,
      types: typedData.types as any,
      primaryType: typedData.primaryType,
      message: typedData.message as any,
    });
  }

  /**
   * Parse ECDSA signature into r, s components
   */
  private parseSignature(signature: Hex): { r: Uint8Array; s: Uint8Array } {
    const sigHex = signature.slice(2); // Remove 0x
    const r = this.hexToBytes(sigHex.slice(0, 64));
    const s = this.hexToBytes(sigHex.slice(64, 128));
    return { r, s };
  }

  /**
   * Serialize witness for single-call capsule
   */
  private serializeWitness(data: {
    r: Uint8Array;
    s: Uint8Array;
    targetAddress: Hex;
    functionSignature: string;
    args: bigint[];
    chainId: bigint;
    txNonce: bigint;
  }): bigint[] {
    const fields: bigint[] = [];

    // Signature r (split into 31-byte chunks for Field encoding)
    fields.push(this.bytesToBigInt(data.r.slice(0, 31)));
    fields.push(this.bytesToBigInt(data.r.slice(31, 32)));

    // Signature s (split into 31-byte chunks)
    fields.push(this.bytesToBigInt(data.s.slice(0, 31)));
    fields.push(this.bytesToBigInt(data.s.slice(31, 32)));

    // Function signature (encoded as bytes, max 128 chars)
    const sigBytes = new TextEncoder().encode(data.functionSignature);
    const sigPadded = new Uint8Array(128);
    sigPadded.set(sigBytes);

    // Split signature into 31-byte chunks (5 fields for 128 bytes)
    for (let i = 0; i < 5; i++) {
      const chunk = sigPadded.slice(i * 31, Math.min((i + 1) * 31, 128));
      fields.push(this.bytesToBigInt(chunk));
    }

    // Signature length
    fields.push(BigInt(sigBytes.length));

    // Args (padded to 20)
    for (let i = 0; i < 20; i++) {
      fields.push(i < data.args.length ? data.args[i] : 0n);
    }

    // Args length
    fields.push(BigInt(data.args.length));

    // Target address
    fields.push(BigInt(data.targetAddress));

    // Chain ID
    fields.push(data.chainId);

    // Tx nonce
    fields.push(data.txNonce);

    return fields;
  }

  /**
   * Serialize witness for 5-call capsule
   */
  private serializeWitness5(data: {
    r: Uint8Array;
    s: Uint8Array;
    calls: FunctionCallInput[];
    chainId: bigint;
    txNonce: bigint;
  }): bigint[] {
    const fields: bigint[] = [];

    // Signature r and s
    fields.push(this.bytesToBigInt(data.r.slice(0, 31)));
    fields.push(this.bytesToBigInt(data.r.slice(31, 32)));
    fields.push(this.bytesToBigInt(data.s.slice(0, 31)));
    fields.push(this.bytesToBigInt(data.s.slice(31, 32)));

    // Serialize each of 5 calls
    for (const call of data.calls) {
      // Function signature
      const sigBytes = new TextEncoder().encode(call.functionSignature);
      const sigPadded = new Uint8Array(128);
      sigPadded.set(sigBytes);

      for (let i = 0; i < 5; i++) {
        const chunk = sigPadded.slice(i * 31, Math.min((i + 1) * 31, 128));
        fields.push(this.bytesToBigInt(chunk));
      }
      fields.push(BigInt(sigBytes.length));

      // Args
      for (let i = 0; i < 20; i++) {
        fields.push(i < call.args.length ? call.args[i] : 0n);
      }
      fields.push(BigInt(call.args.length));

      // Target address
      fields.push(BigInt(call.targetAddress));
    }

    // Chain ID and nonce
    fields.push(data.chainId);
    fields.push(data.txNonce);

    return fields;
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  /**
   * Convert bytes to bigint (big-endian)
   */
  private bytesToBigInt(bytes: Uint8Array): bigint {
    let result = 0n;
    for (const byte of bytes) {
      result = (result << 8n) | BigInt(byte);
    }
    return result;
  }
}
