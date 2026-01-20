import { DefaultAccountInterface } from '@aztec/accounts/defaults';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type {
  AccountContract,
  AccountInterface,
  AuthWitnessProvider,
  ChainInfo,
} from '@aztec/aztec.js/account';
import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import { EcdsaKEthSignerAccountContractArtifact } from '../../artifacts/EcdsaKEthSignerAccount';

/**
 * AccountContract implementation for ECDSA K accounts that use
 * MetaMask's personal_sign for authentication.
 *
 * Unlike standard ECDSA accounts, this does NOT store private keys.
 * Instead, it:
 * 1. Takes the public key coordinates (x, y) during construction
 * 2. Delegates signing to an external AuthWitnessProvider (MetaMask)
 *
 * The Noir contract verifies Ethereum-style personal_sign signatures:
 * - Prepends "\x19Ethereum Signed Message:\n32" to the outer_hash
 * - Computes keccak256 of the prefixed message
 * - Verifies secp256k1 ECDSA signature against this hash
 */
export class EcdsaKEthSignerAccountContract implements AccountContract {
  private readonly publicKeyX: Buffer;
  private readonly publicKeyY: Buffer;
  private readonly authWitnessProvider: AuthWitnessProvider;

  /**
   * Creates a new EcdsaKEthSignerAccountContract.
   *
   * @param publicKeyX - The x coordinate of the secp256k1 public key (32 bytes)
   * @param publicKeyY - The y coordinate of the secp256k1 public key (32 bytes)
   * @param authWitnessProvider - External provider that calls MetaMask for signing
   */
  constructor(
    publicKeyX: Buffer,
    publicKeyY: Buffer,
    authWitnessProvider: AuthWitnessProvider
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
   * This delegates to MetaMask for signing.
   */
  getAuthWitnessProvider(_address: CompleteAddress): AuthWitnessProvider {
    return this.authWitnessProvider;
  }
}
