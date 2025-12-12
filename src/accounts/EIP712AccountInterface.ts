import type { AccountInterface } from '@aztec/aztec.js/account';
import type { ChainInfo, EntrypointInterface } from '@aztec/entrypoints/interfaces';
import type { ExecutionPayload } from '@aztec/entrypoints/payload';
import { Fr } from '@aztec/foundation/fields';
import type { AuthWitness } from '@aztec/stdlib/auth-witness';
import type { AztecAddress } from '@aztec/stdlib/aztec-address';
import { CompleteAddress } from '@aztec/stdlib/contract';
import type { GasSettings } from '@aztec/stdlib/gas';
import type { TxExecutionRequest } from '@aztec/stdlib/tx';
import type { EIP712AuthWitnessProvider, EIP712CallContext } from './EIP712Types';
import {
  EIP712AccountEntrypoint,
  type EIP712EntrypointOptions,
} from './EIP712AccountEntrypoint';

/**
 * Account interface for EIP-712 typed data signing.
 *
 * This interface uses the EIP712AccountEntrypoint to extract call metadata
 * and pass it to the auth witness provider for human-readable signing.
 */
export class EIP712AccountInterface implements AccountInterface {
  protected entrypoint: EntrypointInterface;
  private chainId: Fr;
  private version: Fr;

  constructor(
    private authWitnessProvider: EIP712AuthWitnessProvider,
    private address: CompleteAddress,
    chainInfo: ChainInfo
  ) {
    this.entrypoint = new EIP712AccountEntrypoint(
      address.address,
      authWitnessProvider,
      chainInfo.chainId.toNumber(),
      chainInfo.version.toNumber()
    );
    this.chainId = chainInfo.chainId;
    this.version = chainInfo.version;
  }

  /**
   * Set the call context for the next transaction.
   * This should be called before createTxExecutionRequest to provide
   * the full function signature for display in MetaMask.
   *
   * @param context - The call context with function signature
   */
  setCallContext(context: EIP712CallContext): void {
    this.authWitnessProvider.setCallContext(context);
  }

  createTxExecutionRequest(
    exec: ExecutionPayload,
    gasSettings: GasSettings,
    options: EIP712EntrypointOptions
  ): Promise<TxExecutionRequest> {
    return this.entrypoint.createTxExecutionRequest(exec, gasSettings, options);
  }

  createAuthWit(messageHash: Fr): Promise<AuthWitness> {
    return this.authWitnessProvider.createAuthWit(messageHash);
  }

  getCompleteAddress(): CompleteAddress {
    return this.address;
  }

  getAddress(): AztecAddress {
    return this.address.address;
  }

  getChainId(): Fr {
    return this.chainId;
  }

  getVersion(): Fr {
    return this.version;
  }
}
