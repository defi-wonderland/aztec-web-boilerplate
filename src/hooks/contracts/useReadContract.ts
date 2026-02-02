import { useState, useCallback } from 'react';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, type ContractBase } from '@aztec/aztec.js/contracts';
import {
  useAztecWallet,
  isEmbeddedConnector,
  isBrowserWalletConnector,
} from '../../aztec-wallet';
import { SimulateViewsOp } from '../../types';
import { getContractMethod } from './utils';
import type {
  MethodsOf,
  ArgsOf,
  ReadContractResult,
} from '../../types/contractTypes';

/**
 * Type helper to extract contract type from a contract class.
 * Uses the static `at` method signature to infer the contract instance type.
 */
type ContractClassFor<TContract extends ContractBase> = {
  artifact: ContractArtifact;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  at: (...args: any[]) => Promise<TContract>;
};

interface ReadContractParams<
  TContract extends ContractBase,
  TMethod extends MethodsOf<TContract> = MethodsOf<TContract>,
> {
  /** Contract class - used for type inference and artifact */
  contract: ContractClassFor<TContract>;
  /** Contract address */
  address: string;
  /** Method name to call */
  functionName: TMethod;
  /** Method arguments */
  args: ArgsOf<TContract, TMethod>;
}

/**
 * Hook for executing read/simulate operations on Aztec contracts.
 * Handles both embedded and browser wallet flows automatically.
 *
 * @example
 * ```tsx
 * const { readContract, isPending } = useReadContract();
 *
 * // TypeScript infers method type from functionName
 * const result = await readContract({
 *   contract: TokenContract,
 *   address: tokenAddress,
 *   functionName: 'balance_of_private',
 *   args: [ownerAddress],
 * });
 * ```
 */
export const useReadContract = () => {
  const { connector, account } = useAztecWallet();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readContract = useCallback(
    async <
      TContract extends ContractBase,
      TMethod extends MethodsOf<TContract> = MethodsOf<TContract>,
      TResult = unknown,
    >(
      params: ReadContractParams<TContract, TMethod>
    ): Promise<ReadContractResult<TResult>> => {
      const { contract, address, functionName, args } = params;
      const artifact = contract.artifact;

      if (!connector || !account) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsPending(true);
      setError(null);

      try {
        // ========== BROWSER WALLET FLOW ==========
        if (isBrowserWalletConnector(connector)) {
          const selectedAccount = connector.getCaipAccount();
          if (!selectedAccount) {
            const errorMsg = 'Browser wallet account not selected';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const operation: SimulateViewsOp = {
            kind: 'simulate_views',
            account: selectedAccount,
            calls: [
              {
                kind: 'call',
                contract: address,
                method: String(functionName),
                args: args as unknown[],
              },
            ],
          };

          const result = await connector.executeOperation(operation);

          if (result.status !== 'ok') {
            const errorMsg =
              'error' in result && result.error
                ? result.error
                : 'Simulation failed';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          return {
            success: true,
            data: result.result as TResult,
          };
        }

        // ========== EMBEDDED WALLET FLOW ==========
        if (isEmbeddedConnector(connector)) {
          const wallet = connector.getWallet();
          if (!wallet) {
            const errorMsg = 'Wallet instance not available';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const contractAddress = AztecAddress.fromString(address);
          const contract = await Contract.at(contractAddress, artifact, wallet);

          const method = getContractMethod(contract, String(functionName));
          if (!method) {
            const errorMsg = `Method ${String(functionName)} not found on contract`;
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          // Cast safe: args validated by ArgsOf<TContract, TMethod> at call site
          const result = await method(...(args as unknown[])).simulate({
            from: account.getAddress(),
          });

          return {
            success: true,
            data: result as TResult,
          };
        }

        const errorMsg = 'Unknown wallet type';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsPending(false);
      }
    },
    [connector, account]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsPending(false);
  }, []);

  return {
    readContract,
    isPending,
    error,
    reset,
  };
};
