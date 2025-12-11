/**
 * MetaMaskSigner - External signer implementation for MetaMask
 *
 * Uses MetaMask for signing Aztec transactions via personal_sign.
 * The user's private key never leaves MetaMask.
 */

import type { AuthWitnessProvider } from '@aztec/aztec.js/account';
import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import { type Hex, keccak256, toBytes } from 'viem';
import { ExternalSignerType } from '../types/aztec';
import type { ExternalSigner, ECDSAPublicKey } from './types';
import { MetaMaskAuthWitnessProvider } from '../accounts/MetaMaskAuthWitnessProvider';
import {
  recoverPublicKeyFromSignature,
  getPublicKeyRecoveryMessage,
} from '../utils/evmPublicKeyRecovery';
import type { EVMWalletService } from '../services/evm/EVMWalletService';

/**
 * MetaMaskSigner implements ExternalSigner for MetaMask integration.
 *
 * Flow:
 * 1. User connects MetaMask (via EVMWalletService)
 * 2. We sign a message to recover public key
 * 3. Public key is used to create EcdsaKEthSignerAccountContract
 * 4. Each transaction calls MetaMask for signing via AuthWitnessProvider
 */
export class MetaMaskSigner implements ExternalSigner {
  readonly type = ExternalSignerType.METAMASK;
  readonly label = 'MetaMask';

  private evmService: EVMWalletService;
  private cachedPublicKey: ECDSAPublicKey | null = null;
  private cachedSecretKey: Buffer | null = null;
  private cachedSalt: Buffer | null = null;

  constructor(evmService: EVMWalletService) {
    this.evmService = evmService;
  }

  isAvailable(): boolean {
    return this.evmService.isAvailable();
  }

  isConnected(): boolean {
    return this.evmService.isConnected();
  }

  async connect(): Promise<void> {
    if (this.evmService.isConnected()) {
      return;
    }

    await this.evmService.connect();
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
      throw new Error('MetaMask wallet client not available');
    }

    const address = this.evmService.getAddress();
    if (!address) {
      throw new Error('MetaMask not connected');
    }

    const message = getPublicKeyRecoveryMessage(address);

    const signature = await walletClient.signMessage({
      account: address,
      message,
    });

    // Cache the signature for deriving secret key
    this.cacheSignatureDerivatives(signature, address);

    const publicKey = await recoverPublicKeyFromSignature(message, signature);
    this.cachedPublicKey = publicKey;

    return publicKey;
  }

  createAuthWitnessProvider(_address: CompleteAddress): AuthWitnessProvider {
    const walletClient = this.evmService.getWalletClient();
    const address = this.evmService.getAddress();

    if (!walletClient || !address) {
      throw new Error('MetaMask not connected');
    }

    return new MetaMaskAuthWitnessProvider(walletClient, address);
  }

  async deriveSecretKey(): Promise<Buffer> {
    if (this.cachedSecretKey) {
      return this.cachedSecretKey;
    }

    // Ensure we've signed the message to get the signature
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
      throw new Error('MetaMask not connected');
    }

    // Derive salt from address (deterministic)
    const addressBytes = Buffer.from(address.slice(2).padStart(64, '0'), 'hex');
    this.cachedSalt = addressBytes.slice(0, 32);

    return this.cachedSalt;
  }

  /**
   * Cache signature derivatives for later use
   */
  private cacheSignatureDerivatives(signature: Hex, _address: Hex): void {
    // Derive secret key from signature hash
    const signatureHash = keccak256(toBytes(signature));
    this.cachedSecretKey = Buffer.from(signatureHash.slice(2), 'hex');
  }

  /**
   * Clear all cached values (call on disconnect)
   */
  private clearCache(): void {
    this.cachedPublicKey = null;
    this.cachedSecretKey = null;
    this.cachedSalt = null;
  }
}

/**
 * Factory function to create a MetaMaskSigner
 */
export const createMetaMaskSigner = (
  evmService: EVMWalletService
): MetaMaskSigner => {
  return new MetaMaskSigner(evmService);
};
