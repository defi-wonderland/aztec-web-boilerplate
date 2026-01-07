/**
 * Eip712EVMSigner - EVM signer with EIP-712 clear signing support
 *
 * Uses signTypedData instead of signMessage to show human-readable
 * function arguments in MetaMask when signing Aztec transactions.
 */

import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import { type Hex, keccak256, toBytes } from 'viem';
import { ExternalSignerType } from '../types/aztec';
import type { ExternalSigner, ECDSAPublicKey } from './types';
import { Eip712AuthWitnessProvider } from '../accounts/Eip712AuthWitnessProvider';
import {
  recoverPublicKeyFromSignature,
  getPublicKeyRecoveryMessage,
} from '../utils/evmPublicKeyRecovery';
import type { EVMWalletService } from '../services/evm/EVMWalletService';
import { getEIP6963Service } from '../services/evm/EIP6963Service';

/**
 * EVM Signer that uses EIP-712 clear signing.
 *
 * Key difference from EVMSigner:
 * - Returns Eip712AuthWitnessProvider instead of MetaMaskAuthWitnessProvider
 * - Uses signTypedData to show human-readable function arguments
 * - Requires chain ID for EIP-712 domain
 */
export class Eip712EVMSigner implements ExternalSigner {
  readonly type = ExternalSignerType.EVM_WALLET;
  readonly label = 'EVM Wallet (EIP-712)';
  readonly rdns?: string;

  private evmService: EVMWalletService;
  private chainId: bigint;
  private cachedPublicKey: ECDSAPublicKey | null = null;
  private cachedSecretKey: Buffer | null = null;
  private cachedSalt: Buffer | null = null;

  constructor(evmService: EVMWalletService, chainId: bigint = 31337n, rdns?: string) {
    this.evmService = evmService;
    this.chainId = chainId;
    this.rdns = rdns;
  }

  isAvailable(): boolean {
    if (this.rdns) {
      return getEIP6963Service().isWalletAvailable(this.rdns);
    }
    return this.evmService.isAvailable();
  }

  isConnected(): boolean {
    if (!this.evmService.isConnected()) {
      return false;
    }
    const connectedRdns = this.evmService.getConnectedRdns();
    if (!this.rdns) {
      return true;
    }
    return connectedRdns === this.rdns;
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    const provider = this.rdns
      ? getEIP6963Service().getProviderByRdns(this.rdns)
      : null;

    if (this.rdns && !provider) {
      console.warn(`[Eip712EVMSigner] Wallet ${this.rdns} not found via EIP-6963, falling back to window.ethereum`);
    }

    await this.evmService.connect(provider ?? undefined, this.rdns);
  }

  disconnect(): void {
    this.evmService.disconnect();
    this.clearCache();
  }

  getEVMAddress(): string | null {
    return this.evmService.getAddress();
  }

  async getPublicKey(): Promise<ECDSAPublicKey> {
    if (this.cachedPublicKey) {
      return this.cachedPublicKey;
    }

    const walletClient = this.evmService.getWalletClient();
    if (!walletClient) {
      throw new Error('EVM wallet client not available');
    }

    const address = this.evmService.getAddress();
    if (!address) {
      throw new Error('EVM wallet not connected');
    }

    const message = getPublicKeyRecoveryMessage(address);

    const signature = await walletClient.signMessage({
      account: address,
      message,
    });

    this.cacheSignatureDerivatives(signature);

    const publicKey = await recoverPublicKeyFromSignature(message, signature);
    this.cachedPublicKey = publicKey;

    return publicKey;
  }

  /**
   * Creates an EIP-712 auth witness provider.
   *
   * This provider uses signTypedData to show human-readable
   * function arguments in MetaMask instead of opaque hashes.
   */
  createAuthWitnessProvider(_address: CompleteAddress): Eip712AuthWitnessProvider {
    const walletClient = this.evmService.getWalletClient();
    const address = this.evmService.getAddress();

    if (!walletClient || !address) {
      throw new Error('EVM wallet not connected');
    }

    return new Eip712AuthWitnessProvider(walletClient, address as Hex, this.chainId);
  }

  /**
   * Get the EIP-712 auth witness provider directly.
   * Useful for creating capsules with clear signing.
   */
  getEip712Provider(): Eip712AuthWitnessProvider {
    const walletClient = this.evmService.getWalletClient();
    const address = this.evmService.getAddress();

    if (!walletClient || !address) {
      throw new Error('EVM wallet not connected');
    }

    return new Eip712AuthWitnessProvider(walletClient, address as Hex, this.chainId);
  }

  async deriveSecretKey(): Promise<Buffer> {
    if (this.cachedSecretKey) {
      return this.cachedSecretKey;
    }

    await this.getPublicKey();

    if (!this.cachedSecretKey) {
      throw new Error('Secret key derivation failed - no signature cached');
    }

    return this.cachedSecretKey;
  }

  deriveSalt(): Buffer {
    if (this.cachedSalt) {
      return this.cachedSalt;
    }

    const address = this.getEVMAddress();
    if (!address) {
      throw new Error('EVM wallet not connected');
    }

    const addressBytes = Buffer.from(address.slice(2).padStart(64, '0'), 'hex');
    this.cachedSalt = addressBytes.slice(0, 32);

    return this.cachedSalt;
  }

  private cacheSignatureDerivatives(signature: Hex): void {
    const signatureHash = keccak256(toBytes(signature));
    this.cachedSecretKey = Buffer.from(signatureHash.slice(2), 'hex');
  }

  private clearCache(): void {
    this.cachedPublicKey = null;
    this.cachedSecretKey = null;
    this.cachedSalt = null;
  }
}

export const createEip712EVMSigner = (
  evmService: EVMWalletService,
  chainId: bigint = 31337n,
  rdns?: string
): Eip712EVMSigner => {
  return new Eip712EVMSigner(evmService, chainId, rdns);
};
