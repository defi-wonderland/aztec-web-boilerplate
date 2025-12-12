import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Hex, WalletClient } from 'viem';
import {
  type EIP712AuthWitnessProvider,
  type EIP712CallContext,
  EIP712_DOMAIN,
  EIP712_TYPES,
  MAX_FUNC_SIG_LEN,
} from './EIP712Types';

/**
 * AuthWitnessProvider that uses MetaMask's EIP-712 signTypedData for creating auth witnesses.
 *
 * This provides human-readable transaction signing where users see:
 * - Target contract address
 * - Function signature (e.g., "drip_to_private(Field,Field)")
 * - Arguments hash
 * - Transaction nonce
 *
 * The Noir contract verifies:
 * 1. The function signature computes to the correct selector (Poseidon2)
 * 2. The EIP-712 hash matches what was signed
 * 3. The ECDSA signature is valid
 */
export class MetaMaskAuthWitnessProvider implements EIP712AuthWitnessProvider {
  private readonly walletClient: WalletClient;
  private readonly account: Hex;
  private readonly chainId: number;
  private accountAddress: Hex;
  private callContext: EIP712CallContext | null = null;

  /**
   * Creates a new MetaMaskAuthWitnessProvider.
   *
   * @param walletClient - Viem wallet client connected to MetaMask
   * @param account - The connected Ethereum address (used for signing)
   * @param chainId - The chain ID for EIP-712 domain
   * @param accountAddress - The Aztec account address (verifyingContract in EIP-712 domain).
   *                         Can be updated later via setAccountAddress() if not known at construction time.
   */
  constructor(
    walletClient: WalletClient,
    account: Hex,
    chainId: number,
    accountAddress: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    this.walletClient = walletClient;
    this.account = account;
    this.chainId = chainId;
    this.accountAddress = accountAddress;
  }

  /**
   * Update the Aztec account address after it's known.
   * This is needed because the address is derived from AccountManager,
   * which requires this provider to be created first.
   *
   * @param accountAddress - The Aztec account address as hex
   */
  setAccountAddress(accountAddress: Hex): void {
    this.accountAddress = accountAddress;
  }

  /**
   * Set the call context for the next createAuthWit call.
   * Must be called before createAuthWit().
   *
   * @param context - The call context containing function signature and metadata
   */
  setCallContext(context: EIP712CallContext): void {
    this.callContext = context;
  }

  /**
   * Create an auth witness by signing with MetaMask using EIP-712.
   *
   * @param messageHash - The outer_hash from Aztec (Poseidon hash of the payload)
   * @returns AuthWitness containing signature + function signature + chainId (290 fields)
   */
  async createAuthWit(messageHash: Fr): Promise<AuthWitness> {
    // Use provided context or create a default for deployment/unknown operations
    const context: EIP712CallContext = this.callContext ?? {
      targetContract: AztecAddress.fromString(this.accountAddress),
      functionSignature: 'constructor(pub_key_x,pub_key_y)',
      argsHash: messageHash, // Use messageHash as a proxy for args hash
      nonce: Fr.random(),
    };

    const { targetContract, functionSignature, argsHash, nonce } = context;

    // Validate function signature length
    const funcSigBytes = Buffer.from(functionSignature, 'utf8');
    if (funcSigBytes.length > MAX_FUNC_SIG_LEN) {
      throw new Error(
        `Function signature too long: ${funcSigBytes.length} > ${MAX_FUNC_SIG_LEN}`
      );
    }

    // Build EIP-712 typed data
    // EIP-712 expects 20-byte address, but Aztec uses 32 bytes.
    // Use last 20 bytes of Aztec address for verifyingContract.
    const aztecAddrHex = this.accountAddress.slice(2); // Remove 0x
    const last20Bytes = aztecAddrHex.slice(-40); // Last 40 hex chars = 20 bytes
    const verifyingContract = `0x${last20Bytes}` as Hex;

    const domain = {
      name: EIP712_DOMAIN.name,
      version: EIP712_DOMAIN.version,
      chainId: BigInt(this.chainId),
      verifyingContract,
    };

    const message = {
      outerHash: `0x${messageHash.toBuffer().toString('hex')}` as Hex,
      targetContract: `0x${targetContract.toBuffer().toString('hex')}` as Hex,
      functionSignature,
      argsHash: `0x${argsHash.toBuffer().toString('hex')}` as Hex,
      nonce: nonce.toBigInt(),
    };

    // Sign with MetaMask using EIP-712
    const signature = await this.walletClient.signTypedData({
      account: this.account,
      domain,
      types: EIP712_TYPES,
      primaryType: 'AztecTransaction',
      message,
    });

    // Clear context after use (one-time use per transaction)
    this.callContext = null;

    // Build extended witness
    return this.buildExtendedWitness(messageHash, signature, funcSigBytes, context);
  }

  /**
   * Build the extended auth witness containing:
   * - [0-63]: Signature bytes (r + s)
   * - [64]: Function signature length
   * - [65-192]: Function signature bytes (zero-padded to 128)
   * - [193]: Chain ID
   * - [194-225]: Target contract (32 bytes)
   * - [226-257]: Args hash (32 bytes)
   * - [258-289]: Nonce (32 bytes)
   *
   * @param messageHash - The outer hash being signed
   * @param signature - The EIP-712 signature from MetaMask
   * @param funcSigBytes - The function signature as UTF-8 bytes
   * @param context - The call context used for signing
   * @returns AuthWitness with 290 fields
   */
  private buildExtendedWitness(
    messageHash: Fr,
    signature: Hex,
    funcSigBytes: Buffer,
    context: EIP712CallContext
  ): AuthWitness {
    const witnessFields: Fr[] = [];
    const { targetContract, argsHash, nonce } = context;

    // [0-63]: Signature bytes (r + s, 64 bytes)
    const sigHex = signature.slice(2);
    const r = Buffer.from(sigHex.slice(0, 64), 'hex');
    const s = Buffer.from(sigHex.slice(64, 128), 'hex');

    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(r[i]));
    }
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(s[i]));
    }

    // [64]: Function signature length
    witnessFields.push(new Fr(funcSigBytes.length));

    // [65-192]: Function signature bytes (zero-padded to 128)
    for (let i = 0; i < MAX_FUNC_SIG_LEN; i++) {
      witnessFields.push(new Fr(i < funcSigBytes.length ? funcSigBytes[i] : 0));
    }

    // [193]: Chain ID
    witnessFields.push(new Fr(this.chainId));

    // [194-225]: Target contract (32 bytes)
    const targetContractBytes = targetContract.toBuffer();
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(targetContractBytes[i]));
    }

    // [226-257]: Args hash (32 bytes)
    const argsHashBytes = argsHash.toBuffer();
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(argsHashBytes[i]));
    }

    // [258-289]: Nonce (32 bytes)
    const nonceBytes = nonce.toBuffer();
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(nonceBytes[i]));
    }

    return new AuthWitness(messageHash, witnessFields);
  }
}
