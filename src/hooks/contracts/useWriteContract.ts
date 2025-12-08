import { useState, useCallback } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, type ContractBase } from '@aztec/aztec.js/contracts';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { useUniversalWallet } from '../context/useUniversalWallet';
import {
  isEmbeddedConnector,
  isBrowserWalletConnector,
} from '../../types/walletConnector';
import type {
  MethodsOf,
  ArgsOf,
  WriteContractResult,
} from '../../types/contractTypes';

interface UseWriteContractOptions {
  /** Timeout for transaction confirmation (ms) */
  timeout?: number;
}

/**
 * Type helper to extract contract type from a contract class.
 * Uses the static `at` method signature to infer the contract instance type.
 */
type ContractClassFor<TContract extends ContractBase> = {
  artifact: ContractArtifact;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  at: (...args: any[]) => Promise<TContract>;
};

interface WriteContractParams<
  TContract extends ContractBase,
  TMethod extends MethodsOf<TContract> = MethodsOf<TContract>
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
 * Hook for executing write operations on Aztec contracts.
 * Handles both embedded and browser wallet flows automatically.
 * 
 * @example
 * ```tsx
 * const { writeContract, isPending } = useWriteContract();
 * 
 * // TypeScript infers the method type from functionName
 * await writeContract({
 *   contract: DripperContract,
 *   address: dripperAddress,
 *   functionName: 'drip_to_private',
 *   args: [tokenAddress, 100n],
 * });
 * ```
 */
export const useWriteContract = (options: UseWriteContractOptions = {}) => {
  const { timeout = 900 } = options;
  const { connector, account } = useUniversalWallet();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const writeContract = useCallback(
    async <
      TContract extends ContractBase,
      TMethod extends MethodsOf<TContract> = MethodsOf<TContract>
    >(
      params: WriteContractParams<TContract, TMethod>
    ): Promise<WriteContractResult> => {
      const { contract, address, functionName, args } = params;
      const artifact = contract.artifact;

      if (!connector || !account) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsPending(true);
      setError(null);

      try {
        if (isBrowserWalletConnector(connector)) {
          const response = await connector.sendTransaction({
            actions: [
              {
                contract: address,
                method: String(functionName),
                args: (args as unknown[]).map((arg) =>
                  typeof arg === 'bigint' ? arg.toString() : arg
                ),
              },
            ],
          });

          if (response.status !== 'success') {
            const errorMsg = response.error ?? 'Transaction failed';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          return {
            success: true,
            txHash: response.txHash,
            data: response.rawResult,
          };
        }

        if (isEmbeddedConnector(connector)) {
          const wallet = connector.getWallet();
          if (!wallet) {
            const errorMsg = 'Wallet instance not available';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const paymentMethod = await connector.getSponsoredFeePaymentMethod();
          const contractAddress = AztecAddress.fromString(address);
          
          // Create contract instance
          const contract = await Contract.at(contractAddress, artifact, wallet);
          
          // Get the method and call it
          const method = (contract as unknown as { methods: Record<string, (...args: unknown[]) => unknown> })
            .methods[String(functionName)];
          
          if (!method) {
            const errorMsg = `Method ${String(functionName)} not found on contract`;
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const tx = method(...(args as unknown[]));
          const result = await (tx as { send: (opts: unknown) => { wait: (opts: unknown) => Promise<unknown> } })
            .send({
              from: account.getAddress(),
              fee: { paymentMethod },
            })
            .wait({ timeout });

          return {
            success: true,
            data: result,
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
    [connector, account, timeout]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsPending(false);
  }, []);

  return {
    writeContract,
    isPending,
    error,
    reset,
  };
};
