import type {
  ReadContractsContract,
  ReadContractResult,
} from '../../types/contractTypes';
import type { AztecExecutionClient } from '../types/execution';

/**
 * Parameters for the `readContracts` action.
 * Subset of `UseReadContractsParams` without query/hook-specific fields.
 */
export interface ReadContractsActionParams {
  contracts: ReadContractsContract[];
  allowFailure?: boolean;
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
export const readContracts = async (
  client: AztecExecutionClient,
  params: ReadContractsActionParams
): Promise<ReadContractResult[] | unknown[]> => {
  const allowFailure = params.allowFailure ?? true;

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
