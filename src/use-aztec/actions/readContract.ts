import type { ContractBase } from '@aztec/aztec.js/contracts';
import type {
  ArgsOf,
  ContractClassFor,
  MethodsOf,
} from '../types/contractTypes';
import type { AztecExecutionClient } from '../types/execution';

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
 * @param client - The execution client (provided by the calling hook via context).
 * @param params - Contract read parameters.
 *
 * @example
 * ```ts
 * const result = await readContract(client, {
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
  client: AztecExecutionClient,
  params: ReadContractActionParams<T, M>
): Promise<unknown> => {
  return client.executeRead({
    artifact: params.contract.artifact,
    address: params.address,
    functionName: String(params.functionName),
    args: params.args as unknown[],
  });
};
