/**
 * External Signer Types
 *
 * Defines the interface for external signers that can be used with
 * app-managed PXE (External Signer wallet category).
 */

import type { AuthWitnessProvider } from '@aztec/aztec.js/account';
import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import { ExternalSignerType } from '../types/aztec';

// Re-export for convenience
export { ExternalSignerType };

/**
 * Public key coordinates for secp256k1 ECDSA signers
 */
export interface ECDSAPublicKey {
  x: Buffer;
  y: Buffer;
}

/**
 * ExternalSigner interface defines the contract for external signing wallets
 * that delegate signing to browser extensions (MetaMask, WalletConnect, etc.)
 * while the app manages the PXE connection.
 */
export interface ExternalSigner {
  /**
   * Unique identifier for this signer type
   */
  readonly type: ExternalSignerType;

  /**
   * Human-readable label for UI display
   */
  readonly label: string;

  /**
   * Reverse domain name identifier (for EIP-6963 wallet discovery)
   * Used to identify specific EVM wallets (e.g., 'io.metamask', 'io.rabby')
   */
  readonly rdns?: string;

  /**
   * Check if the external wallet is installed/available
   */
  isAvailable(): boolean;

  /**
   * Check if currently connected to the external wallet
   */
  isConnected(): boolean;

  /**
   * Connect to the external wallet (e.g., trigger MetaMask popup)
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the external wallet
   */
  disconnect(): void;

  /**
   * Get the EVM address from the connected wallet
   */
  getEVMAddress(): string | null;

  /**
   * Recover the public key by signing a deterministic message.
   * This is used during account setup to derive the Aztec account.
   */
  getPublicKey(): Promise<ECDSAPublicKey>;

  /**
   * Create an AuthWitnessProvider that delegates signing to this external wallet.
   * Called for each transaction to get signatures.
   *
   * @param address - The Aztec account address (for context, may not be needed by all signers)
   */
  createAuthWitnessProvider(address: CompleteAddress): AuthWitnessProvider;

  /**
   * Derive a secret key from the wallet signature.
   * Used to derive privacy keys for the Aztec account.
   */
  deriveSecretKey(): Promise<Buffer>;

  /**
   * Derive a salt from the wallet identity.
   * Used to deterministically generate Aztec account addresses.
   */
  deriveSalt(): Buffer;
}

/**
 * Factory function type for creating external signers
 */
export type ExternalSignerFactory = () => ExternalSigner;
