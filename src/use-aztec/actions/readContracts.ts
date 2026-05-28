import type { ReadContractsContract } from '../types/contractTypes';
import type { AztecExecutionClient, BatchReadResult } from '../types/execution';

/**
 * Parameters for the `readContracts` action.
 * Subset of `UseReadContractsParams` without query/hook-specific fields.
 */
export interface ReadContractsActionParams<
  TAllowFailure extends boolean = true,
> {
  contracts: ReadContractsContract[];
  allowFailure?: TAllowFailure;
}

/**
 * Pure async action for batching multiple Aztec contract reads.
 *
 * @param client - The execution client (provided by the calling hook via context).
 * @param params - Batch read parameters.
 *
 * @example
 * ```ts
 * const results = await readContracts(client, {
 *   contracts: [
 *     { contract: TokenContract, address, functionName: 'balance_of_private', args: [owner] },
 *     { contract: TokenContract, address, functionName: 'balance_of_public', args: [owner] },
 *   ],
 *   allowFailure: false,
 * });
 * ```
 */
export const readContracts = async <TAllowFailure extends boolean = true>(
  client: AztecExecutionClient,
  params: ReadContractsActionParams<TAllowFailure>
): Promise<BatchReadResult<TAllowFailure>> => {
  const allowFailure = (params.allowFailure ?? true) as TAllowFailure;

  return client.executeBatchRead({
    contracts: params.contracts.map((c) => ({
      artifact: c.contract.artifact,
      address: c.address,
      functionName: String(c.functionName),
      args: c.args as unknown[],
    })),
    allowFailure,
  });
};
