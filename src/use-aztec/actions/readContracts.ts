import { getClient } from '../config/clientStore';
import type {
  ReadContractsContract,
  ReadContractResult,
} from '../../types/contractTypes';

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
 * Resolves the execution client from the module-level store (set by UseAztecProvider).
 * Throws `AztecClientNotReadyError` if the provider hasn't initialized yet.
 *
 * @example
 * ```ts
 * const results = await readContracts({
 *   contracts: [
 *     { contract: TokenContract, address, functionName: 'balance_of_private', args: [owner] },
 *     { contract: TokenContract, address, functionName: 'balance_of_public', args: [owner] },
 *   ],
 *   allowFailure: false,
 * });
 * ```
 */
export const readContracts = async (
  params: ReadContractsActionParams
): Promise<ReadContractResult[] | unknown[]> => {
  const client = getClient();
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
