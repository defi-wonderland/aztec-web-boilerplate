/**
 * EIP-712 Account Contract Implementation
 *
 * This account contract uses EIP-712 typed data signing for human-readable
 * authorization requests via MetaMask/Ethereum wallets.
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import {
  keccak256,
  type Hex,
  hexToBytes,
  bytesToHex,
  pad,
  toHex,
  hashTypedData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Eip712Encoder, DEFAULT_APP_DOMAIN } from './eip712-encoder';
import {
  type FunctionCall,
  ACCOUNT_MAX_CALLS,
  EIP712_WITNESS_SLOT as WITNESS_SLOT,
  EIP712_WITNESS_5_SLOT,
  EIP712_AUTHWIT_SLOT,
  MAX_SIGNATURE_SIZE,
  MAX_SERIALIZED_ARGS,
  EIP712_WITNESS_SERIALIZED_LEN as WITNESS_LEN,
  EIP712_WITNESS_5_SERIALIZED_LEN,
  EIP712_AUTHWIT_SERIALIZED_LEN,
  DEFAULT_VERIFYING_CONTRACT,
  EMPTY_FUNCTION_CALL,
} from './eip712-types';
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { Capsule } from '@aztec/stdlib/tx';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';

// =============================================================================
// Re-export constants for backward compatibility
// =============================================================================

/** Legacy AuthWitness size (for backward compatibility) */
export const WITNESS_SIZE = 35;

/** Capsule slot for EIP-712 witness data (must match Noir EIP712_WITNESS_SLOT) */
export const EIP712_WITNESS_SLOT = WITNESS_SLOT;

/** Serialized size of Eip712Witness struct in Fields */
export const EIP712_WITNESS_SERIALIZED_LEN = WITNESS_LEN;

// Re-export for convenience
export { MAX_SIGNATURE_SIZE, MAX_SERIALIZED_ARGS, ACCOUNT_MAX_CALLS };

// =============================================================================
// Types
// =============================================================================

export interface Eip712OracleData {
  functionSignature: Uint8Array;      // [MAX_SIGNATURE_SIZE]
  signatureLength: number;
  functionArgs: bigint[];             // [MAX_SERIALIZED_ARGS]
  argsLength: number;
  targetAddress: bigint;
  chainId: bigint;
  salt: Uint8Array;                   // 32 bytes
  ecdsaSignature: Uint8Array;         // 64 bytes (r || s)
}

/** Oracle data for 5-call entrypoint */
export interface Eip712OracleData5 {
  ecdsaSignature: Uint8Array;                           // 64 bytes (r || s) - shared
  functionSignatures: Uint8Array[];                     // [5][MAX_SIGNATURE_SIZE]
  signatureLengths: number[];                           // [5]
  functionArgs: bigint[][];                             // [5][MAX_SERIALIZED_ARGS]
  argsLengths: number[];                                // [5]
  targetAddresses: bigint[];                            // [5]
  chainId: bigint;
  salt: Uint8Array;                                     // 32 bytes
}

/** Oracle data for individual authwit */
export interface Eip712AuthwitOracleData {
  ecdsaSignature: Uint8Array;         // 64 bytes (r || s)
  functionSignature: Uint8Array;      // [MAX_SIGNATURE_SIZE]
  signatureLength: number;
  functionArgs: bigint[];             // [MAX_SERIALIZED_ARGS]
  argsLength: number;
  targetAddress: bigint;
  chainId: bigint;
  verifyingContract: bigint;
  innerHash: bigint;
}

export interface FunctionCallInput {
  targetAddress: bigint;
  functionSignature: string;
  args: bigint[];
}

// =============================================================================
// EIP-712 Account Class
// =============================================================================

/**
 * Account class that handles EIP-712 signing for Aztec transactions.
 *
 * This class:
 * 1. Generates/stores the ECDSA private key
 * 2. Creates EIP-712 typed data for signing
 * 3. Produces the oracle data needed by the Noir contract
 */
export class Eip712Account {
  private privateKey: Hex;
  private publicKeyX: Uint8Array;
  private publicKeyY: Uint8Array;
  private encoder: Eip712Encoder;

  constructor(privateKey?: Hex, chainId: bigint = 31337n) {
    // Generate or use provided private key
    if (privateKey) {
      this.privateKey = privateKey;
    } else {
      // Generate random private key
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      this.privateKey = bytesToHex(randomBytes);
    }

    // Derive public key
    const publicKey = secp256k1.getPublicKey(hexToBytes(this.privateKey).slice(0, 32), false);
    // Skip the 0x04 prefix for uncompressed public key
    this.publicKeyX = publicKey.slice(1, 33);
    this.publicKeyY = publicKey.slice(33, 65);

    this.encoder = new Eip712Encoder({ chainId });
  }

  /**
   * Get the public key components for contract initialization
   */
  getPublicKey(): { x: Uint8Array; y: Uint8Array } {
    return {
      x: this.publicKeyX,
      y: this.publicKeyY,
    };
  }

  /**
   * Get public key as arrays of numbers (for contract constructor)
   */
  getPublicKeyArrays(): { x: number[]; y: number[] } {
    return {
      x: Array.from(this.publicKeyX),
      y: Array.from(this.publicKeyY),
    };
  }

  /**
   * Get the Ethereum address derived from the public key
   */
  getEthAddress(): Hex {
    const pubKeyBytes = new Uint8Array(64);
    pubKeyBytes.set(this.publicKeyX, 0);
    pubKeyBytes.set(this.publicKeyY, 32);
    const hash = keccak256(pubKeyBytes);
    return `0x${hash.slice(-40)}` as Hex;
  }

  /**
   * Sign an entrypoint authorization and produce oracle data (single function call)
   */
  async signEntrypoint(
    functionCallInput: FunctionCallInput,
    txNonce: bigint,
    salt: Hex = DEFAULT_APP_DOMAIN.salt,
  ): Promise<Eip712OracleData> {
    // Convert input to FunctionCall format
    const functionCall = Eip712Encoder.createFunctionCall(
      functionCallInput.targetAddress,
      functionCallInput.functionSignature,
      functionCallInput.args,
    );

    // Build typed data
    const typedData = this.encoder.buildEntrypointTypedData(functionCall, txNonce);

    // Sign using viem's account
    const account = privateKeyToAccount(this.privateKey);
    const signature = await account.signTypedData(typedData);

    // Parse signature (remove v, keep r || s)
    const sigBytes = hexToBytes(signature);
    const ecdsaSignature = sigBytes.slice(0, 64); // r (32) + s (32)

    // Build oracle data
    return this.buildOracleData(
      functionCallInput,
      typedData.domain.chainId as bigint,
      hexToBytes(salt),
      ecdsaSignature,
    );
  }

  /**
   * Build oracle data from single function call and signature
   */
  private buildOracleData(
    call: FunctionCallInput,
    chainId: bigint,
    salt: Uint8Array,
    ecdsaSignature: Uint8Array,
  ): Eip712OracleData {
    const MAX_SIGNATURE_SIZE = 128;
    const MAX_SERIALIZED_ARGS = 20;

    // Function signature as bytes
    const sigBytes = new TextEncoder().encode(call.functionSignature);
    const functionSignature = new Uint8Array(MAX_SIGNATURE_SIZE);
    functionSignature.set(sigBytes.slice(0, MAX_SIGNATURE_SIZE));
    const signatureLength = Math.min(sigBytes.length, MAX_SIGNATURE_SIZE);

    // Function args (padded)
    const functionArgs = [...call.args];
    while (functionArgs.length < MAX_SERIALIZED_ARGS) {
      functionArgs.push(0n);
    }
    const argsLength = Math.min(call.args.length, MAX_SERIALIZED_ARGS);

    return {
      functionSignature,
      signatureLength,
      functionArgs: functionArgs.slice(0, MAX_SERIALIZED_ARGS),
      argsLength,
      targetAddress: call.targetAddress,
      chainId,
      salt,
      ecdsaSignature,
    };
  }

  /**
   * Verify a signature locally (for testing)
   */
  verifySignature(
    functionCallInput: FunctionCallInput,
    txNonce: bigint,
    signature: Hex,
  ): boolean {
    // Convert input to FunctionCall format
    const functionCall = Eip712Encoder.createFunctionCall(
      functionCallInput.targetAddress,
      functionCallInput.functionSignature,
      functionCallInput.args,
    );

    // Build typed data
    const typedData = this.encoder.buildEntrypointTypedData(functionCall, txNonce);

    // Compute the hash that was signed
    const hash = hashTypedData(typedData);

    // Verify signature
    const sigBytes = hexToBytes(signature);
    const r = sigBytes.slice(0, 32);
    const s = sigBytes.slice(32, 64);

    try {
      const sig = new secp256k1.Signature(
        BigInt(bytesToHex(r)),
        BigInt(bytesToHex(s)),
      );
      const pubKey = secp256k1.getPublicKey(hexToBytes(this.privateKey).slice(0, 32), false);
      return secp256k1.verify(sig, hexToBytes(hash).slice(0, 32), pubKey);
    } catch {
      return false;
    }
  }

  /**
   * Compute the EIP-712 hashes for debugging/verification
   */
  computeHashes(
    functionCallInput: FunctionCallInput,
    txNonce: bigint,
  ): {
    domainSeparator: Hex;
    messageHash: Hex;
    eip712Payload: Hex;
  } {
    const functionCall = Eip712Encoder.createFunctionCall(
      functionCallInput.targetAddress,
      functionCallInput.functionSignature,
      functionCallInput.args,
    );

    const typedData = this.encoder.buildEntrypointTypedData(functionCall, txNonce);
    const domainSeparator = Eip712Encoder.computeDomainSeparator(typedData.domain.chainId as bigint);
    const messageHash = Eip712Encoder.hashEntrypointAuthorization(
      typedData.message.appDomain,
      typedData.message.functionCall,
      txNonce,
    );
    const eip712Payload = Eip712Encoder.computeEip712Payload(domainSeparator, messageHash);

    return {
      domainSeparator,
      messageHash,
      eip712Payload,
    };
  }

  /**
   * Create a Capsule containing EIP-712 witness data.
   *
   * This is the preferred method for passing witness data to the Noir contract.
   * The capsule is loaded via `capsules::load` in the entrypoint.
   *
   * @param functionCallInput - The function call to authorize
   * @param txNonce - Transaction nonce (must match app_payload.tx_nonce)
   * @param contractAddress - The account contract address
   * @param salt - Optional salt for EIP-712 domain (defaults to DEFAULT_APP_DOMAIN.salt)
   * @returns Capsule containing the serialized Eip712Witness struct
   */
  async createWitnessCapsule(
    functionCallInput: FunctionCallInput,
    txNonce: bigint,
    contractAddress: AztecAddress,
    salt: Hex = DEFAULT_APP_DOMAIN.salt,
  ): Promise<Capsule> {
    // Sign and get oracle data
    const oracleData = await this.signEntrypoint(functionCallInput, txNonce, salt);

    // Serialize to capsule data format (must match Noir Eip712Witness::serialize)
    const capsuleData = this.serializeWitnessToCapsule(oracleData);

    return new Capsule(contractAddress, new Fr(EIP712_WITNESS_SLOT), capsuleData);
  }

  /**
   * Serialize Eip712OracleData to capsule data format.
   *
   * Layout (must match Noir Eip712Witness::serialize):
   * - [0-2]: Signature (64 bytes packed as 31+31+2)
   * - [3-7]: Function signature (128 bytes packed as 31+31+31+31+4)
   * - [8]: Signature length
   * - [9-28]: Function args (20 fields)
   * - [29]: Args length
   * - [30]: Target address
   * - [31]: Chain ID
   * - [32]: Salt (first 31 bytes)
   */
  private serializeWitnessToCapsule(data: Eip712OracleData): Fr[] {
    const fields: Fr[] = [];

    // [0-2]: Signature (64 bytes -> 3 fields: 31+31+2)
    fields.push(...this.packBytes(data.ecdsaSignature, [31, 31, 2]));

    // [3-7]: Function signature (128 bytes -> 5 fields: 31+31+31+31+4)
    fields.push(...this.packBytes(data.functionSignature, [31, 31, 31, 31, 4]));

    // [8]: Signature length
    fields.push(new Fr(data.signatureLength));

    // [9-28]: Args (20 Fr) - native fields, no packing
    for (let i = 0; i < MAX_SERIALIZED_ARGS; i++) {
      fields.push(new Fr(data.functionArgs[i]));
    }

    // [29]: Args length
    fields.push(new Fr(data.argsLength));

    // [30]: Target address
    fields.push(new Fr(data.targetAddress));

    // [31]: Chain ID
    fields.push(new Fr(data.chainId));

    // [32]: Salt (first 31 bytes only - the 32nd byte is assumed to be 0)
    fields.push(this.packBytes(data.salt, [31])[0]);

    return fields;
  }

  /**
   * @deprecated Use createWitnessCapsule instead. This method is kept for backward compatibility.
   *
   * Create an AuthWitness for use with Aztec's get_auth_witness oracle.
   *
   * This method:
   * 1. Signs the EIP-712 typed data
   * 2. Packages the signature and call metadata into a 35-field AuthWitness (packed bytes)
   *
   * @param functionCallInput - The function call to authorize
   * @param txNonce - Transaction nonce (must match app_payload.tx_nonce)
   * @param payloadHash - The app_payload.hash() value (lookup key for oracle)
   * @param salt - Optional salt for EIP-712 domain (defaults to DEFAULT_APP_DOMAIN.salt)
   * @returns AuthWitness with 249 fields matching the Noir witness layout
   */
  async createAuthWitness(
    functionCallInput: FunctionCallInput,
    txNonce: bigint,
    payloadHash: Fr,
    salt: Hex = DEFAULT_APP_DOMAIN.salt,
  ): Promise<AuthWitness> {
    // Sign and get oracle data (reuse existing method)
    const oracleData = await this.signEntrypoint(functionCallInput, txNonce, salt);

    // Convert to 35-field witness format (packed bytes)
    return this.buildAuthWitness(payloadHash, oracleData);
  }

  /**
   * Build a 35-field AuthWitness from oracle data (packed bytes format).
   *
   * Witness layout (must match Noir eip712.nr):
   * - [0-2]: Signature r+s (64 bytes packed into 3 Fr: 31+31+2)
   * - [3]: Function signature length
   * - [4-8]: Function signature (128 bytes packed into 5 Fr: 31+31+31+31+4)
   * - [9]: Arguments count
   * - [10-29]: Function arguments (20 Fields)
   * - [30]: Target address (Fr)
   * - [31]: Chain ID (Fr)
   * - [32-33]: Salt (32 bytes packed into 2 Fr: 31+1)
   * - [34]: Unused/padding
   */
  private buildAuthWitness(payloadHash: Fr, data: Eip712OracleData): AuthWitness {
    const fields: Fr[] = [];

    // [0-2]: Signature (64 bytes -> 3 fields: 31+31+2)
    fields.push(...this.packBytes(data.ecdsaSignature, [31, 31, 2]));

    // [3]: Function signature length
    fields.push(new Fr(data.signatureLength));

    // [4-8]: Function signature (128 bytes -> 5 fields: 31+31+31+31+4)
    fields.push(...this.packBytes(data.functionSignature, [31, 31, 31, 31, 4]));

    // [9]: Args length
    fields.push(new Fr(data.argsLength));

    // [10-29]: Args (20 Fr) - native fields, no packing
    for (let i = 0; i < 20; i++) {
      fields.push(new Fr(data.functionArgs[i]));
    }

    // [30]: Target address
    fields.push(new Fr(data.targetAddress));

    // [31]: Chain ID
    fields.push(new Fr(data.chainId));

    // [32-33]: Salt (32 bytes -> 2 fields: 31+1)
    fields.push(...this.packBytes(data.salt, [31, 1]));

    // [34]: Padding
    fields.push(new Fr(0n));

    return new AuthWitness(payloadHash, fields);
  }

  // ==========================================================================
  // 5-Call Entrypoint Methods (NEW)
  // ==========================================================================

  /**
   * Sign an entrypoint authorization for up to 5 function calls.
   * Empty slots are padded with EMPTY_FUNCTION_CALL.
   */
  async signEntrypoint5(
    calls: FunctionCallInput[],
    txNonce: bigint,
    verifyingContract: Hex = DEFAULT_VERIFYING_CONTRACT,
    salt: Hex = DEFAULT_APP_DOMAIN.salt,
  ): Promise<Eip712OracleData5> {
    if (calls.length > ACCOUNT_MAX_CALLS) {
      throw new Error(`Too many calls: ${calls.length} > ${ACCOUNT_MAX_CALLS}`);
    }

    // Convert inputs to FunctionCall format and pad to 5
    const functionCalls: FunctionCall[] = calls.map(call =>
      Eip712Encoder.createFunctionCall(call.targetAddress, call.functionSignature, call.args)
    );
    while (functionCalls.length < ACCOUNT_MAX_CALLS) {
      functionCalls.push(EMPTY_FUNCTION_CALL);
    }

    // Build typed data for 5 calls
    const typedData = this.encoder.buildEntrypointTypedData5(functionCalls, txNonce, verifyingContract);

    // Sign using viem's account
    const account = privateKeyToAccount(this.privateKey);
    const signature = await account.signTypedData(typedData);

    // Parse signature (remove v, keep r || s)
    const sigBytes = hexToBytes(signature);
    const ecdsaSignature = sigBytes.slice(0, 64);

    return this.buildOracleData5(calls, typedData.domain.chainId as bigint, hexToBytes(salt), ecdsaSignature);
  }

  /**
   * Build oracle data for 5 function calls.
   */
  private buildOracleData5(
    calls: FunctionCallInput[],
    chainId: bigint,
    salt: Uint8Array,
    ecdsaSignature: Uint8Array,
  ): Eip712OracleData5 {
    const functionSignatures: Uint8Array[] = [];
    const signatureLengths: number[] = [];
    const functionArgs: bigint[][] = [];
    const argsLengths: number[] = [];
    const targetAddresses: bigint[] = [];

    // Process each call (pad to ACCOUNT_MAX_CALLS)
    for (let i = 0; i < ACCOUNT_MAX_CALLS; i++) {
      const call = i < calls.length ? calls[i] : { targetAddress: 0n, functionSignature: '', args: [] };

      // Function signature as bytes
      const sigBytes = new TextEncoder().encode(call.functionSignature);
      const funcSig = new Uint8Array(MAX_SIGNATURE_SIZE);
      funcSig.set(sigBytes.slice(0, MAX_SIGNATURE_SIZE));
      functionSignatures.push(funcSig);
      signatureLengths.push(Math.min(sigBytes.length, MAX_SIGNATURE_SIZE));

      // Function args (padded)
      const args = [...call.args];
      while (args.length < MAX_SERIALIZED_ARGS) {
        args.push(0n);
      }
      functionArgs.push(args.slice(0, MAX_SERIALIZED_ARGS));
      argsLengths.push(Math.min(call.args.length, MAX_SERIALIZED_ARGS));

      targetAddresses.push(call.targetAddress);
    }

    return {
      ecdsaSignature,
      functionSignatures,
      signatureLengths,
      functionArgs,
      argsLengths,
      targetAddresses,
      chainId,
      salt,
    };
  }

  /**
   * Create a Capsule for 5-call entrypoint.
   *
   * @param calls - 1-5 function calls to authorize
   * @param txNonce - Transaction nonce (must match app_payload.tx_nonce)
   * @param contractAddress - The account contract address
   * @param verifyingContract - Optional verifying contract (defaults to sandbox rollup)
   * @param salt - Optional salt for EIP-712 domain
   */
  async createWitnessCapsule5(
    calls: FunctionCallInput[],
    txNonce: bigint,
    contractAddress: AztecAddress,
    verifyingContract: Hex = DEFAULT_VERIFYING_CONTRACT,
    salt: Hex = DEFAULT_APP_DOMAIN.salt,
  ): Promise<Capsule> {
    const oracleData = await this.signEntrypoint5(calls, txNonce, verifyingContract, salt);
    const capsuleData = this.serializeWitness5ToCapsule(oracleData);
    return new Capsule(contractAddress, new Fr(EIP712_WITNESS_5_SLOT), capsuleData);
  }

  /**
   * Serialize Eip712OracleData5 to capsule data format (145 Fields).
   *
   * Layout (must match Noir Eip712Witness5::serialize):
   * [0-2]: Signature (64 bytes: 31+31+2)
   * Per call (x5) at offset 3 + call_idx * 28:
   *   [+0..+4]: func_sig (128 bytes: 31+31+31+31+4)
   *   [+5]: sig_len
   *   [+6..+25]: args (20 fields)
   *   [+26]: args_len
   *   [+27]: target
   * [143]: chain_id
   * [144]: salt (31 bytes)
   */
  private serializeWitness5ToCapsule(data: Eip712OracleData5): Fr[] {
    const fields: Fr[] = [];

    // [0-2]: Signature (64 bytes -> 3 fields: 31+31+2)
    fields.push(...this.packBytes(data.ecdsaSignature, [31, 31, 2]));

    // [3-142]: 5 calls, each 28 fields
    for (let callIdx = 0; callIdx < ACCOUNT_MAX_CALLS; callIdx++) {
      // Function signature (128 bytes -> 5 fields: 31+31+31+31+4)
      fields.push(...this.packBytes(data.functionSignatures[callIdx], [31, 31, 31, 31, 4]));

      // Signature length
      fields.push(new Fr(data.signatureLengths[callIdx]));

      // Function args (20 fields)
      for (let i = 0; i < MAX_SERIALIZED_ARGS; i++) {
        fields.push(new Fr(data.functionArgs[callIdx][i]));
      }

      // Args length
      fields.push(new Fr(data.argsLengths[callIdx]));

      // Target address
      fields.push(new Fr(data.targetAddresses[callIdx]));
    }

    // [143]: chain_id
    fields.push(new Fr(data.chainId));

    // [144]: salt (first 31 bytes)
    fields.push(this.packBytes(data.salt, [31])[0]);

    return fields;
  }

  // ==========================================================================
  // Individual Authwit Methods (NEW)
  // ==========================================================================

  /**
   * Sign an individual authorization (authwit) for a single function call.
   * Used by verify_private_authwit.
   */
  async signAuthwit(
    call: FunctionCallInput,
    verifyingContract: Hex,
    innerHash: bigint = 0n,
  ): Promise<Eip712AuthwitOracleData> {
    // Convert to FunctionCall format
    const functionCall = Eip712Encoder.createFunctionCall(
      call.targetAddress,
      call.functionSignature,
      call.args,
    );

    // Build typed data
    const typedData = this.encoder.buildAuthwitTypedData(functionCall, verifyingContract);

    // Sign using viem's account
    const account = privateKeyToAccount(this.privateKey);
    const signature = await account.signTypedData(typedData);

    // Parse signature
    const sigBytes = hexToBytes(signature);
    const ecdsaSignature = sigBytes.slice(0, 64);

    // Build oracle data
    const sigBytesEncoded = new TextEncoder().encode(call.functionSignature);
    const functionSignature = new Uint8Array(MAX_SIGNATURE_SIZE);
    functionSignature.set(sigBytesEncoded.slice(0, MAX_SIGNATURE_SIZE));

    const functionArgs = [...call.args];
    while (functionArgs.length < MAX_SERIALIZED_ARGS) {
      functionArgs.push(0n);
    }

    return {
      ecdsaSignature,
      functionSignature,
      signatureLength: Math.min(sigBytesEncoded.length, MAX_SIGNATURE_SIZE),
      functionArgs: functionArgs.slice(0, MAX_SERIALIZED_ARGS),
      argsLength: Math.min(call.args.length, MAX_SERIALIZED_ARGS),
      targetAddress: call.targetAddress,
      chainId: typedData.domain.chainId as bigint,
      verifyingContract: BigInt(verifyingContract),
      innerHash,
    };
  }

  /**
   * Create a Capsule for individual authwit verification.
   *
   * @param call - The function call to authorize
   * @param verifyingContract - The contract requesting the authwit
   * @param contractAddress - The account contract address
   * @param innerHash - The inner_hash passed to verify_private_authwit
   */
  async createAuthwitCapsule(
    call: FunctionCallInput,
    verifyingContract: Hex,
    contractAddress: AztecAddress,
    innerHash: bigint = 0n,
  ): Promise<Capsule> {
    const oracleData = await this.signAuthwit(call, verifyingContract, innerHash);
    const capsuleData = this.serializeAuthwitToCapsule(oracleData);
    return new Capsule(contractAddress, new Fr(EIP712_AUTHWIT_SLOT), capsuleData);
  }

  /**
   * Serialize Eip712AuthwitOracleData to capsule data format (34 Fields).
   *
   * Layout (must match Noir Eip712AuthwitWitness::serialize):
   * [0-2]: Signature (64 bytes: 31+31+2)
   * [3-7]: func_sig (128 bytes: 31+31+31+31+4)
   * [8]: sig_len
   * [9-28]: args (20 fields)
   * [29]: args_len
   * [30]: target
   * [31]: chain_id
   * [32]: verifying_contract
   * [33]: inner_hash
   */
  private serializeAuthwitToCapsule(data: Eip712AuthwitOracleData): Fr[] {
    const fields: Fr[] = [];

    // [0-2]: Signature
    fields.push(...this.packBytes(data.ecdsaSignature, [31, 31, 2]));

    // [3-7]: Function signature
    fields.push(...this.packBytes(data.functionSignature, [31, 31, 31, 31, 4]));

    // [8]: Signature length
    fields.push(new Fr(data.signatureLength));

    // [9-28]: Function args
    for (let i = 0; i < MAX_SERIALIZED_ARGS; i++) {
      fields.push(new Fr(data.functionArgs[i]));
    }

    // [29]: Args length
    fields.push(new Fr(data.argsLength));

    // [30]: Target address
    fields.push(new Fr(data.targetAddress));

    // [31]: Chain ID
    fields.push(new Fr(data.chainId));

    // [32]: Verifying contract
    fields.push(new Fr(data.verifyingContract));

    // [33]: Inner hash
    fields.push(new Fr(data.innerHash));

    return fields;
  }

  /**
   * Pack bytes into Fr fields (big-endian, up to 31 bytes per field)
   */
  private packBytes(bytes: Uint8Array, bytesPerField: number[]): Fr[] {
    const fields: Fr[] = [];
    let offset = 0;

    for (const size of bytesPerField) {
      const chunk = bytes.slice(offset, offset + size);
      // Convert chunk to bigint (big-endian)
      let value = 0n;
      for (let i = 0; i < chunk.length; i++) {
        value = (value << 8n) | BigInt(chunk[i]);
      }
      fields.push(new Fr(value));
      offset += size;
    }

    return fields;
  }
}

/**
 * Create an EIP-712 account from a hex private key
 */
export function createEip712Account(privateKey: Hex, chainId?: bigint): Eip712Account {
  return new Eip712Account(privateKey, chainId);
}

/**
 * Generate a new random EIP-712 account
 */
export function generateEip712Account(chainId?: bigint): Eip712Account {
  return new Eip712Account(undefined, chainId);
}
