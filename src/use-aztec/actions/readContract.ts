import type { ContractBase } from '@aztec/aztec.js/contracts';
import { getClient } from '../config/clientStore';
import type {
  ArgsOf,
  ContractClassFor,
  MethodsOf,
} from '../../types/contractTypes';

/**
 * Parameters for the `readContract` action.
 * Subset of `UseReadContractParams` without query/hook-specific fields.
 */
export interface ReadContractActionParams<
  TContract extends ContractBase,
  TMethod extends MethodsOf<TContract>,
> {
  contract: ContractClassFor<TContract>;
  address: string;
  functionName: TMethod;
  args: ArgsOf<TContract, TMethod>;
}

/**
 * Pure async action for reading/simulating an Aztec contract method.
 *
 * Resolves the execution client from the module-level store (set by UseAztecProvider).
 * Throws `AztecClientNotReadyError` if the provider hasn't initialized yet.
 *
 * @example
 * ```ts
 * const result = await readContract({
 *   contract: TokenContract,
 *   address: tokenAddress,
 *   functionName: 'balance_of_public',
 *   args: [ownerAddress],
 * });
 * ```
 */
export const readContract = async <
  T extends ContractBase,
  M extends MethodsOf<T>,
>(
  params: ReadContractActionParams<T, M>
): Promise<unknown> => {
  const client = getClient();

  return client.executeRead({
    artifact: params.contract.artifact,
    address: params.address,
    functionName: String(params.functionName),
    args: params.args as unknown[],
  });
};
