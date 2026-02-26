/**
 * Core batch read execution for both wallet modes.
 *
 * Pure async functions — no React dependency.
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecAddress as AztecAddressType } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { getContractMethod } from '../utils/getContractMethod';
import type { SimulateViewsOp } from '../../types/browserWallet';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
} from '../../types/browserWallet';
import type { BatchReadContract, BatchReadResult } from '../runtime/types';

/**
 * Parse the raw result from a browser wallet batch simulation.
 * The result may be `{ decoded: unknown[] }` or a direct array.
 */
export const parseBatchResult = (
  raw: unknown,
  expectedLength: number
): unknown[] => {
  if (Array.isArray(raw)) return raw;

  const obj = raw as Record<string, unknown> | null | undefined;
  if (obj && 'decoded' in obj && Array.isArray(obj.decoded)) {
    return obj.decoded;
  }

  // Single-call result wrapped — return as single-element array
  if (expectedLength === 1) return [raw];

  throw new Error(
    `Unexpected batch result shape: expected array of ${expectedLength} results`
  );
};

// =============================================================================
// Browser Wallet Batch
// =============================================================================

export interface BrowserWalletBatchParams {
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>;
  getCaipAccount: () => string | null;
  contracts: BatchReadContract[];
  allowFailure: boolean;
}

/**
 * Execute a batch of contract reads via browser wallet (single round-trip).
 */
export const executeBrowserWalletBatch = async (
  params: BrowserWalletBatchParams
): Promise<BatchReadResult[] | unknown[]> => {
  const { executeOperation, getCaipAccount, contracts, allowFailure } = params;

  const selectedAccount = getCaipAccount();
  if (!selectedAccount) {
    throw new Error('Browser wallet account not selected');
  }

  const operation: SimulateViewsOp = {
    kind: 'simulate_views',
    account: selectedAccount,
    calls: contracts.map((c) => ({
      kind: 'call' as const,
      contract: c.address,
      method: c.functionName,
      args: c.args,
    })),
  };

  const result = await executeOperation(operation);

  if (result.status !== 'ok') {
    const errorMsg =
      'error' in result && result.error
        ? result.error
        : 'Batch simulation failed';

    if (allowFailure) {
      return contracts.map(() => ({
        status: 'failure' as const,
        error: new Error(errorMsg),
      }));
    }
    throw new Error(errorMsg);
  }

  const results = parseBatchResult(result.result, contracts.length);

  if (allowFailure) {
    return results.map((r) => ({
      status: 'success' as const,
      result: r,
    }));
  }

  return results;
};

// =============================================================================
// App-Managed Batch
// =============================================================================

export interface AppManagedBatchParams {
  wallet: Wallet;
  fromAddress: AztecAddressType;
  contracts: BatchReadContract[];
  allowFailure: boolean;
}

/**
 * Execute a batch of contract reads via app-managed PXE (sequential simulate calls).
 * PXE does not support concurrent operations, so calls are executed one at a time.
 * Contract instances are cached by address+artifact to avoid redundant instantiation.
 */
export const executeAppManagedBatch = async (
  params: AppManagedBatchParams
): Promise<BatchReadResult[] | unknown[]> => {
  const { wallet, fromAddress, contracts, allowFailure } = params;

  const contractCache = new Map<string, ReturnType<typeof Contract.at>>();
  const results: (BatchReadResult | unknown)[] = [];

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
          status: 'failure' as const,
          error: new Error(
            `Method ${contract.functionName} not found on contract`
          ),
        });
        continue;
      }
      throw new Error(`Method ${contract.functionName} not found on contract`);
    }

    try {
      const result = await method(...contract.args).simulate({
        from: fromAddress,
      });
      results.push(
        allowFailure ? { status: 'success' as const, result } : result
      );
    } catch (err) {
      if (allowFailure) {
        results.push({
          status: 'failure' as const,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      } else {
        throw err;
      }
    }
  }

  return results as BatchReadResult[] | unknown[];
};
