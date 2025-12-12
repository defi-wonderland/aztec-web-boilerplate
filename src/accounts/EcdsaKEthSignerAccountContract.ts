import type {
  AccountContract,
  AccountInterface,
  ChainInfo,
} from '@aztec/aztec.js/account';
import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { EcdsaKEthSignerAccountContractArtifact } from '../artifacts/EcdsaKEthSignerAccount';
import type { EIP712AuthWitnessProvider } from './EIP712Types';
import { EIP712AccountInterface } from './EIP712AccountInterface';

/**
 * AccountContract implementation for ECDSA K accounts that use
 * MetaMask's EIP-712 signTypedData for authentication.
 *
 * Unlike standard ECDSA accounts, this does NOT store private keys.
 * Instead, it:
 * 1. Takes the public key coordinates (x, y) during construction
 * 2. Delegates signing to an external EIP712AuthWitnessProvider (MetaMask)
 *
 * The Noir contract verifies EIP-712 typed data signatures:
 * - Computes selector from function signature (Poseidon2)
 * - Verifies selector matches actual call
 * - Computes EIP-712 hash
 * - Verifies secp256k1 ECDSA signature against this hash
 *
 * Users see human-readable transaction info in MetaMask:
 * - Target contract address
 * - Function signature (e.g., "drip_to_private(Field,Field)")
 * - Arguments hash
 * - Transaction nonce
 */
export class EcdsaKEthSignerAccountContract implements AccountContract {
  private readonly publicKeyX: Buffer;
  private readonly publicKeyY: Buffer;
  private readonly authWitnessProvider: EIP712AuthWitnessProvider;

  /**
   * Creates a new EcdsaKEthSignerAccountContract.
   *
   * @param publicKeyX - The x coordinate of the secp256k1 public key (32 bytes)
   * @param publicKeyY - The y coordinate of the secp256k1 public key (32 bytes)
   * @param authWitnessProvider - EIP712 provider that calls MetaMask for signing
   */
  constructor(
    publicKeyX: Buffer,
    publicKeyY: Buffer,
    authWitnessProvider: EIP712AuthWitnessProvider
  ) {
    if (publicKeyX.length !== 32 || publicKeyY.length !== 32) {
      throw new Error('Public key coordinates must be 32 bytes each');
    }
    this.publicKeyX = publicKeyX;
    this.publicKeyY = publicKeyY;
    this.authWitnessProvider = authWitnessProvider;
  }

  /**
   * Returns the contract artifact for deployment.
   */
  getContractArtifact(): Promise<ContractArtifact> {
    return Promise.resolve(EcdsaKEthSignerAccountContractArtifact);
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
   * Uses EIP712AccountInterface for human-readable MetaMask signing.
   */
  getInterface(
    address: CompleteAddress,
    chainInfo: ChainInfo
  ): AccountInterface {
    return new EIP712AccountInterface(
      this.authWitnessProvider,
      address,
      chainInfo
    );
  }

  /**
   * Returns the auth witness provider.
   * This delegates to MetaMask for EIP-712 signing.
   */
  getAuthWitnessProvider(
    _address: CompleteAddress
  ): EIP712AuthWitnessProvider {
    return this.authWitnessProvider;
  }
}
