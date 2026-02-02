/**
 * EVMSigner - External signer implementation for EVM wallets
 *
 * Works with any EVM wallet via EIP-6963 discovery.
 * Uses personal_sign for signing Aztec transactions.
 * The user's private key never leaves the wallet.
 */

import { type Hex, keccak256, toBytes } from 'viem';
import type { AuthWitnessProvider } from '@aztec/aztec.js/account';
import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import { getEIP6963Service } from '../services/evm/EIP6963Service';
import { MetaMaskAuthWitnessProvider } from './MetaMaskAuthWitnessProvider';
import { ExternalSignerType } from './types';
import {
  recoverPublicKeyFromSignature,
  getPublicKeyRecoveryMessage,
} from './utils/evmPublicKeyRecovery';
import type { ExternalSigner, ECDSAPublicKey } from './types';
import type { EVMWalletService } from '../services/evm/EVMWalletService';

export class EVMSigner implements ExternalSigner {
  readonly type: ExternalSignerType = ExternalSignerType.EVM_WALLET;
  readonly label = 'EVM Wallet';
  readonly rdns?: string;

  private evmService: EVMWalletService;
  private cachedPublicKey: ECDSAPublicKey | null = null;
  private cachedSecretKey: Buffer | null = null;
  private cachedSalt: Buffer | null = null;

  constructor(evmService: EVMWalletService, rdns?: string) {
    this.evmService = evmService;
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
    // If already connected to this specific wallet, skip
    if (this.isConnected()) {
      return;
    }

    // Get specific provider via EIP-6963 if rdns is set
    const provider = this.rdns
      ? getEIP6963Service().getProviderByRdns(this.rdns)
      : null;

    if (this.rdns && !provider) {
      console.warn(
        `[EVMSigner] Wallet ${this.rdns} not found via EIP-6963, falling back to window.ethereum`
      );
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

    this.cacheSignatureDerivatives(signature, address);

    const publicKey = await recoverPublicKeyFromSignature(message, signature);
    this.cachedPublicKey = publicKey;

    return publicKey;
  }

  createAuthWitnessProvider(_address: CompleteAddress): AuthWitnessProvider {
    const walletClient = this.evmService.getWalletClient();
    const address = this.evmService.getAddress();

    if (!walletClient || !address) {
      throw new Error('EVM wallet not connected');
    }

    return new MetaMaskAuthWitnessProvider(walletClient, address);
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

  private cacheSignatureDerivatives(signature: Hex, _address: Hex): void {
    const signatureHash = keccak256(toBytes(signature));
    this.cachedSecretKey = Buffer.from(signatureHash.slice(2), 'hex');
  }

  private clearCache(): void {
    this.cachedPublicKey = null;
    this.cachedSecretKey = null;
    this.cachedSalt = null;
  }
}

export const createEVMSigner = (
  evmService: EVMWalletService,
  rdns?: string
): EVMSigner => {
  return new EVMSigner(evmService, rdns);
};
