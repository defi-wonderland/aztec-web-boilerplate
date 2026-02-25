import { useState, useCallback, useRef } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, type ContractBase } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import {
  useAztecWallet,
  hasAppManagedPXE,
  isBrowserWalletConnector,
} from '../../aztec-wallet';
import { getContractMethod, resolveArtifact } from './utils';
import type {
  SimulateViewsOp,
  BrowserWalletOperationResult,
} from '../../types';
import type {
  ContractClassFor,
  MethodsOf,
  ReadContractConfig,
  ReadContractResult,
  DynamicReadContractConfig,
} from '../../types/contractTypes';

export interface ReadContractParams<
  TContract extends ContractBase,
  TMethod extends MethodsOf<TContract> = MethodsOf<TContract>,
> extends ReadContractConfig<TContract, TMethod> {
  /** Contract class - used for type inference and artifact */
  contract: ContractClassFor<TContract>;
}

/** Params for a dynamic (untyped) read — passes artifact directly. */
export interface DynamicReadContractParams extends DynamicReadContractConfig {}

// ---- Wallet resolution (shared between readContract and readContracts) ----

type WalletContext =
  | {
      type: 'browser';
      account: string;
      executeOperation: (
        op: SimulateViewsOp
      ) => Promise<BrowserWalletOperationResult>;
    }
  | {
      type: 'app_managed';
      wallet: Wallet;
      fromAddress: AztecAddress;
    }
  | { type: 'error'; error: string };

/**
 * Hook for executing read/simulate operations on Aztec contracts.
 * Handles browser wallet, embedded, and external signer flows automatically.
 *
 * @example
 * ```tsx
 * const { readContract, readContracts, isPending } = useReadContract();
 *
 * // Single call
 * const result = await readContract({
 *   contract: TokenContract,
 *   address: tokenAddress,
 *   functionName: 'balance_of_private',
 *   args: [ownerAddress],
 * });
 *
 * // Batch call — browser wallets use a single round-trip
 * const [privateResult, publicResult] = await readContracts([
 *   { contract: TokenContract, address: tokenAddress, functionName: 'balance_of_private', args: [owner] },
 *   { contract: TokenContract, address: tokenAddress, functionName: 'balance_of_public', args: [owner] },
 * ]);
 * ```
 */
export const useReadContract = () => {
  const { connector, account } = useAztecWallet();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCountRef = useRef(0);

  /** Resolve the current wallet into a context both functions can use. */
  const resolveWallet = useCallback((): WalletContext => {
    if (!connector || !account) {
      return { type: 'error', error: 'Wallet not connected' };
    }

    if (isBrowserWalletConnector(connector)) {
      const selectedAccount = connector.getCaipAccount();
      if (!selectedAccount) {
        return { type: 'error', error: 'Browser wallet account not selected' };
      }
      return {
        type: 'browser',
        account: selectedAccount,
        executeOperation: (op: SimulateViewsOp) =>
          connector.executeOperation(op),
      };
    }

    if (hasAppManagedPXE(connector)) {
      const wallet = connector.getWallet();
      if (!wallet) {
        return { type: 'error', error: 'Wallet instance not available' };
      }
      return {
        type: 'app_managed',
        wallet,
        fromAddress: account.getAddress(),
      };
    }

    return { type: 'error', error: 'Unknown wallet type' };
  }, [connector, account]);

  /**
   * Increment the pending counter and set isPending to true.
   * Safe for concurrent calls — isPending stays true until all complete.
   */
  const startPending = useCallback(() => {
    pendingCountRef.current++;
    setIsPending(true);
    setError(null);
  }, []);

  /**
   * Decrement the pending counter.
   * Only sets isPending to false when all concurrent calls have finished.
   */
  const endPending = useCallback(() => {
    pendingCountRef.current--;
    if (pendingCountRef.current === 0) {
      setIsPending(false);
    }
  }, []);

  const readContract = useCallback(
    async <
      TContract extends ContractBase,
      TMethod extends MethodsOf<TContract> = MethodsOf<TContract>,
      TResult = unknown,
    >(
      params: ReadContractParams<TContract, TMethod> | DynamicReadContractParams
    ): Promise<ReadContractResult<TResult>> => {
      const ctx = resolveWallet();
      if (ctx.type === 'error') {
        return { success: false, error: ctx.error };
      }

      const artifact = resolveArtifact(params);

      startPending();
      try {
        const { address, functionName, args } = params;

        if (ctx.type === 'browser') {
          const operation: SimulateViewsOp = {
            kind: 'simulate_views',
            account: ctx.account,
            calls: [
              {
                kind: 'call',
                contract: address,
                method: String(functionName),
                args: args as unknown[],
              },
            ],
          };

          const result = await ctx.executeOperation(operation);

          if (result.status !== 'ok') {
            const errorMsg =
              'error' in result && result.error
                ? result.error
                : 'Simulation failed';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          return { success: true, data: result.result as TResult };
        }

        // ctx.type === 'app_managed'
        const contractAddress = AztecAddress.fromString(address);
        const contract = await Contract.at(
          contractAddress,
          artifact,
          ctx.wallet
        );

        const method = getContractMethod(contract, String(functionName));
        if (!method) {
          const errorMsg = `Method ${String(functionName)} not found on contract`;
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const result = await method(...(args as unknown[])).simulate({
          from: ctx.fromAddress,
        });

        return { success: true, data: result as TResult };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        endPending();
      }
    },
    [resolveWallet, startPending, endPending]
  );

  /**
   * Batch read — browser wallets batch all calls into a single round-trip.
   * App-managed PXE executes sequentially (PXE doesn't support concurrency).
   * Returns a tuple of results matching the input length.
   */
  const readContracts = useCallback(
    async <
      const T extends (
        | ReadContractParams<ContractBase, MethodsOf<ContractBase>>
        | DynamicReadContractParams
      )[],
    >(
      params: [...T]
    ): Promise<{ [K in keyof T]: ReadContractResult }> => {
      const ctx = resolveWallet();
      if (ctx.type === 'error') {
        return params.map(() => ({
          success: false,
          error: ctx.error,
        })) as { [K in keyof T]: ReadContractResult };
      }

      startPending();
      try {
        if (ctx.type === 'browser') {
          const operation: SimulateViewsOp = {
            kind: 'simulate_views',
            account: ctx.account,
            calls: params.map((p) => ({
              kind: 'call' as const,
              contract: p.address,
              method: String(p.functionName),
              args: p.args as unknown[],
            })),
          };

          const result = await ctx.executeOperation(operation);

          if (result.status !== 'ok') {
            const errorMsg =
              'error' in result && result.error
                ? result.error
                : 'Batch simulation failed';
            setError(errorMsg);
            return params.map(() => ({
              success: false,
              error: errorMsg,
            })) as { [K in keyof T]: ReadContractResult };
          }

          // Validate the expected batch result shape from browser wallet
          const decoded = Array.isArray(
            (result.result as Record<string, unknown>)?.decoded
          )
            ? (result.result as { decoded: unknown[] }).decoded
            : null;

          if (!decoded) {
            const errorMsg =
              'Unexpected batch result format from browser wallet';
            setError(errorMsg);
            return params.map(() => ({
              success: false,
              error: errorMsg,
            })) as { [K in keyof T]: ReadContractResult };
          }

          if (decoded.length !== params.length) {
            const errorMsg =
              'Unexpected batch result length from browser wallet';
            setError(errorMsg);
            return params.map(() => ({
              success: false,
              error: errorMsg,
            })) as { [K in keyof T]: ReadContractResult };
          }

          return params.map((_, i) => ({
            success: true,
            data: decoded[i],
          })) as { [K in keyof T]: ReadContractResult };
        }

        // ctx.type === 'app_managed' — sequential with contract instance caching
        const results: ReadContractResult[] = [];
        const contractCache = new Map<string, ContractBase>();

        for (const param of params) {
          const paramArtifact = resolveArtifact(param);
          const cacheKey = `${param.address}:${paramArtifact.name}`;
          let contract = contractCache.get(cacheKey);
          if (!contract) {
            const contractAddress = AztecAddress.fromString(param.address);
            contract = await Contract.at(
              contractAddress,
              paramArtifact,
              ctx.wallet
            );
            contractCache.set(cacheKey, contract);
          }

          const method = getContractMethod(
            contract,
            String(param.functionName)
          );
          if (!method) {
            results.push({
              success: false,
              error: `Method ${String(param.functionName)} not found on contract`,
            });
            continue;
          }

          const result = await method(...(param.args as unknown[])).simulate({
            from: ctx.fromAddress,
          });
          results.push({ success: true, data: result });
        }

        return results as { [K in keyof T]: ReadContractResult };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return params.map(() => ({
          success: false,
          error: errorMsg,
        })) as { [K in keyof T]: ReadContractResult };
      } finally {
        endPending();
      }
    },
    [resolveWallet, startPending, endPending]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsPending(false);
    pendingCountRef.current = 0;
  }, []);

  return {
    readContract,
    readContracts,
    isPending,
    error,
    reset,
  };
};
