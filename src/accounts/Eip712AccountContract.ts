/**
 * Eip712AccountContract - AccountContract implementation for EIP-712 accounts
 *
 * Uses MetaMask's signTypedData for human-readable authorization requests.
 * Unlike EcdsaKEthSignerAccountContract which shows opaque hashes, this contract
 * displays function names, arguments, and target contracts in MetaMask.
 */

import type {
  AccountContract,
  AccountInterface,
  AuthWitnessProvider,
  ChainInfo,
} from '@aztec/aztec.js/account';
import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { DefaultAccountInterface } from '@aztec/accounts/defaults';
import { Eip712AccountContractArtifact } from '../artifacts/Eip712Account';
import { Eip712AuthWitnessProvider } from './Eip712AuthWitnessProvider';
import type { WalletClient, Hex } from 'viem';

/**
 * AccountContract implementation for EIP-712 accounts that use
 * MetaMask's signTypedData for human-readable authorization.
 *
 * Key features:
 * 1. Shows function name and arguments in MetaMask popup
 * 2. Uses ECDSA secp256k1 signatures (same curve as Ethereum)
 * 3. Supports capsule-based witness passing for custom entrypoint
 *
 * Unlike standard accounts, this one doesn't use the standard AccountActions::entrypoint.
 * Instead, it has a custom entrypoint that:
 * 1. Loads EIP-712 witness from capsule
 * 2. Reconstructs the EIP-712 hash from individual arguments
 * 3. Verifies the ECDSA signature
 */
export class Eip712AccountContract implements AccountContract {
  private readonly publicKeyX: Buffer;
  private readonly publicKeyY: Buffer;
  private readonly walletClient: WalletClient;
  private readonly ethAddress: Hex;
  private readonly chainId: bigint;

  /**
   * Creates a new Eip712AccountContract.
   *
   * @param publicKeyX - The x coordinate of the secp256k1 public key (32 bytes)
   * @param publicKeyY - The y coordinate of the secp256k1 public key (32 bytes)
   * @param walletClient - viem WalletClient for MetaMask interactions
   * @param ethAddress - The Ethereum address for signing
   * @param chainId - The chain ID for EIP-712 domain
   */
  constructor(
    publicKeyX: Buffer,
    publicKeyY: Buffer,
    walletClient: WalletClient,
    ethAddress: Hex,
    chainId: bigint = 31337n
  ) {
    if (publicKeyX.length !== 32 || publicKeyY.length !== 32) {
      throw new Error('Public key coordinates must be 32 bytes each');
    }
    this.publicKeyX = publicKeyX;
    this.publicKeyY = publicKeyY;
    this.walletClient = walletClient;
    this.ethAddress = ethAddress;
    this.chainId = chainId;
  }

  /**
   * Returns the contract artifact for deployment.
   */
  getContractArtifact(): Promise<ContractArtifact> {
    return Promise.resolve(Eip712AccountContractArtifact);
  }

  /**
   * Returns the initialization function and its arguments.
   * The constructor takes the public key coordinates as u8 arrays.
   */
  async getInitializationFunctionAndArgs(): Promise<{
    constructorName: string;
    constructorArgs: unknown[];
  }> {
    return {
      constructorName: 'constructor',
      constructorArgs: [
        Array.from(this.publicKeyX), // Convert Buffer to number array for Noir
        Array.from(this.publicKeyY),
      ],
    };
  }

  /**
   * Returns the account interface for creating tx requests.
   */
  getInterface(
    address: CompleteAddress,
    chainInfo: ChainInfo
  ): AccountInterface {
    return new DefaultAccountInterface(
      this.getAuthWitnessProvider(address),
      address,
      chainInfo
    );
  }

  /**
   * Returns the auth witness provider.
   * This creates an Eip712AuthWitnessProvider that uses signTypedData.
   */
  getAuthWitnessProvider(_address: CompleteAddress): AuthWitnessProvider {
    return new Eip712AuthWitnessProvider(
      this.walletClient,
      this.ethAddress,
      this.chainId
    );
  }
}

/**
 * Helper to derive public key from Ethereum address using MetaMask
 * Note: This requires the user to sign a message to extract the public key
 */
export async function derivePublicKeyFromMetaMask(
  walletClient: WalletClient,
  address: Hex
): Promise<{ x: Buffer; y: Buffer }> {
  // Sign a known message to extract public key
  const signature = await walletClient.signMessage!({
    account: address,
    message: 'Derive Aztec public key',
  });

  // Import the recovery function from viem
  const { recoverPublicKey, hashMessage } = await import('viem');
  const messageHash = hashMessage('Derive Aztec public key');
  const publicKey = await recoverPublicKey({
    hash: messageHash,
    signature,
  });

  // publicKey is 0x04 + x (32 bytes) + y (32 bytes)
  const pubKeyHex = publicKey.slice(4); // Remove 0x04 prefix
  const x = Buffer.from(pubKeyHex.slice(0, 64), 'hex');
  const y = Buffer.from(pubKeyHex.slice(64), 'hex');

  return { x, y };
}
