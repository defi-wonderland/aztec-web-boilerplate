/**
 * Core batch read execution for app-managed wallets.
 *
 * Pure async functions — no React dependency.
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecAddress as AztecAddressType } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { getContractMethod } from './utils/getContractMethod';
import type { ReadContractResult } from '../../use-aztec/types/contractTypes';
import type {
  BatchReadResult,
  ReadExecutionParams,
} from '../../use-aztec/types/execution';

// =============================================================================
// App-Managed Batch
// =============================================================================

export interface AppManagedBatchParams<
  TAllowFailure extends boolean = boolean,
> {
  wallet: Wallet;
  fromAddress: AztecAddressType;
  contracts: ReadExecutionParams[];
  allowFailure: TAllowFailure;
}

/**
 * Execute a batch of contract reads via app-managed PXE (sequential simulate calls).
 * PXE does not support concurrent operations, so calls are executed one at a time.
 * Contract instances are cached by address+artifact to avoid redundant instantiation.
 */
export const executeAppManagedBatch = async <TAllowFailure extends boolean>(
  params: AppManagedBatchParams<TAllowFailure>
): Promise<BatchReadResult<TAllowFailure>> => {
  const { wallet, fromAddress, contracts, allowFailure } = params;

  const contractCache = new Map<string, ReturnType<typeof Contract.at>>();
  const results: ReadContractResult[] = [];

  for (const contract of contracts) {
    const cacheKey = `${contract.address}:${contract.artifact.name}`;
    let contractInstance = contractCache.get(cacheKey);
    if (!contractInstance) {
      const contractAddress = AztecAddress.fromString(contract.address);
      contractInstance = Contract.at(
        contractAddress,
        contract.artifact,
        wallet
      );
      contractCache.set(cacheKey, contractInstance);
    }

    const method = getContractMethod(contractInstance, contract.functionName);
    if (!method) {
      if (allowFailure) {
        results.push({
          status: 'failed' as const,
          error: new Error(
            `Method ${contract.functionName} not found on contract`
          ),
        });
        continue;
      }
      throw new Error(`Method ${contract.functionName} not found on contract`);
    }

    try {
      const { result } = await method(...contract.args).simulate({
        from: fromAddress,
      });
      results.push({ status: 'success' as const, result });
    } catch (err) {
      if (allowFailure) {
        results.push({
          status: 'failed' as const,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      } else {
        throw err;
      }
    }
  }

  if (allowFailure) {
    return results as BatchReadResult<TAllowFailure>;
  }
  return results.map((r) => r.result) as BatchReadResult<TAllowFailure>;
};
