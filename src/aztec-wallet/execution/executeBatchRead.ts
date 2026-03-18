/**
 * Core batch read execution for both wallet modes.
 *
 * Pure async functions — no React dependency.
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecAddress as AztecAddressType } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { getContractMethod } from './utils/getContractMethod';
import { serializeArgs } from './utils/serializeArgs';
import type {
  ReadContractResult,
  BatchReadResult,
  ReadExecutionParams,
} from '../../use-aztec/types';
import type { SimulateViewsOp } from '../types/browserWallet';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
} from '../types/browserWallet';

/**
 * Parse the raw result from a browser wallet batch simulation.
 * The result may be `{ decoded: unknown[] }` or a direct array.
 */
export const parseBatchResult = (
  raw: unknown,
  expectedLength: number
): unknown[] => {
  const assertExpectedLength = (results: unknown[]): unknown[] => {
    if (results.length !== expectedLength) {
      throw new Error(
        `Unexpected batch result length: expected ${expectedLength} result(s), received ${results.length}`
      );
    }
    return results;
  };

  if (Array.isArray(raw)) {
    return assertExpectedLength(raw);
  }

  const obj = raw as Record<string, unknown> | null | undefined;
  if (obj && typeof obj === 'object' && 'decoded' in obj) {
    const decoded = obj.decoded;
    if (!Array.isArray(decoded)) {
      throw new Error(
        'Unexpected batch result shape: decoded must be an array'
      );
    }

    return assertExpectedLength(decoded);
  }

  throw new Error(
    `Unexpected batch result shape: expected array or { decoded: unknown[] }, received ${typeof raw}`
  );
};

// =============================================================================
// Browser Wallet Batch
// =============================================================================

export interface BrowserWalletBatchParams<
  TAllowFailure extends boolean = boolean,
> {
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>;
  getCaipAccount: () => string | null;
  contracts: ReadExecutionParams[];
  allowFailure: TAllowFailure;
}

/**
 * Execute a batch of contract reads via browser wallet (single round-trip).
 */
export const executeBrowserWalletBatch = async <TAllowFailure extends boolean>(
  params: BrowserWalletBatchParams<TAllowFailure>
): Promise<BatchReadResult<TAllowFailure>> => {
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
      args: serializeArgs(c.args),
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
        status: 'failed' as const,
        error: new Error(errorMsg),
      })) as BatchReadResult<TAllowFailure>;
    }
    throw new Error(errorMsg);
  }

  // Normalize: some wallets return an unwrapped value for single-call batches.
  // Skip wrapping if the result is a `{ decoded: [...] }` envelope — parseBatchResult
  // handles that shape directly.
  const raw = result.result;
  const isDecodedEnvelope =
    raw != null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'decoded' in raw;
  const normalized =
    contracts.length === 1 && !Array.isArray(raw) && !isDecodedEnvelope
      ? [raw]
      : raw;

  const results = parseBatchResult(normalized, contracts.length);

  if (allowFailure) {
    return results.map((r) => ({
      status: 'success' as const,
      result: r,
    })) as BatchReadResult<TAllowFailure>;
  }

  return results as BatchReadResult<TAllowFailure>;
};

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
      const result = await method(...contract.args).simulate({
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
