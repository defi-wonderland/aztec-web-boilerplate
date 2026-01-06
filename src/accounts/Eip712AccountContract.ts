/**
 * EIP-712 Account Contract Wrapper
 *
 * AccountContract implementation for EIP-712 clear signing accounts.
 * Uses signTypedData to show human-readable function arguments in MetaMask.
 */

import type { AccountContract, AccountInterface, ChainInfo } from '@aztec/aztec.js/account';
import type { CompleteAddress, AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { DefaultAccountInterface } from '@aztec/accounts/defaults';

import { Eip712AuthWitnessProvider } from './Eip712AuthWitnessProvider';
// This will be generated after compiling the contract
// import { Eip712AccountContractArtifact } from '../artifacts/Eip712Account';

/**
 * Placeholder artifact until we compile the contract
 */
const Eip712AccountContractArtifact: ContractArtifact = {
  name: 'Eip712Account',
  functions: [
    { name: 'constructor', parameters: [], returnTypes: [] },
    { name: 'entrypoint', parameters: [], returnTypes: [] },
    { name: 'entrypoint5', parameters: [], returnTypes: [] },
    { name: 'verify_private_authwit', parameters: [], returnTypes: [] },
  ],
} as any;

/**
 * AccountContract implementation for EIP-712 clear signing accounts.
 *
 * Key differences from standard ECDSA accounts:
 * - Uses signTypedData instead of signMessage
 * - Displays human-readable function arguments in MetaMask
 * - Supports both single-call (entrypoint) and batch (entrypoint5)
 */
export class Eip712AccountContract implements AccountContract {
  public readonly publicKeyX: Buffer;
  public readonly publicKeyY: Buffer;
  private readonly authWitnessProvider: Eip712AuthWitnessProvider;

  /**
   * Creates a new Eip712AccountContract.
   *
   * @param publicKeyX - The x coordinate of the secp256k1 public key (32 bytes)
   * @param publicKeyY - The y coordinate of the secp256k1 public key (32 bytes)
   * @param authWitnessProvider - EIP-712 auth witness provider for signTypedData
   */
  constructor(
    publicKeyX: Buffer,
    publicKeyY: Buffer,
    authWitnessProvider: Eip712AuthWitnessProvider
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
  getContractArtifact(): ContractArtifact {
    return Eip712AccountContractArtifact;
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
  getInterface(address: CompleteAddress | AztecAddress, chainInfo?: ChainInfo): AccountInterface {
    // Handle both CompleteAddress and AztecAddress
    const completeAddress = 'address' in address
      ? address as CompleteAddress
      : { address } as any;

    return new DefaultAccountInterface(
      this.authWitnessProvider as any,
      completeAddress,
      chainInfo || { chainId: 31337n } as any
    );
  }

  /**
   * Returns the EIP-712 auth witness provider.
   * Uses signTypedData for human-readable signing.
   */
  getAuthWitnessProvider(): Eip712AuthWitnessProvider {
    return this.authWitnessProvider;
  }
}
