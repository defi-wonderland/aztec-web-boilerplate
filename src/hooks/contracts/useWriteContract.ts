import { useState, useCallback } from 'react';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, type ContractBase } from '@aztec/aztec.js/contracts';
import {
  useAztecWallet,
  isBrowserWalletConnector,
  hasAppManagedPXE,
} from '../../aztec-wallet';
import { createFeePaymentMethod } from '../../services/aztec/feePayment';
import { DEFAULT_FEE_PAYMENT_METHOD } from '../../store/feePayment';
import { waitForBrowserWalletReceipt } from '../../utils/txReceipt';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';
import type {
  MethodsOf,
  ArgsOf,
  WriteContractResult,
} from '../../types/contractTypes';

interface UseWriteContractOptions {
  /** Timeout for transaction confirmation (ms) - used by embedded wallet */
  timeout?: number;
  /** Receipt polling options - used by browser wallet */
  receiptPolling?: {
    intervalMs?: number;
    maxAttempts?: number;
  };
}

/**
 * Type helper to extract contract type from a contract class.
 * Uses the static `at` method signature to infer the contract instance type.
 */
type ContractClassFor<TContract extends ContractBase> = {
  artifact: ContractArtifact;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  at: (...args: any[]) => TContract;
};

interface WriteContractParams<
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
  /** Fee payment method to use (defaults to DEFAULT_FEE_PAYMENT_METHOD) */
  feePaymentMethod?: FeePaymentMethodType;
}

const getChainFromCaipAccount = (caipAccount: string): string => {
  const parts = caipAccount.split(':');
  return `${parts[0]}:${parts[1]}`;
};

/**
 * Hook for executing write operations on Aztec contracts.
 * Handles both embedded and browser wallet flows automatically.
 * Uses the global fee payment method from Settings.
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
  const { timeout = 900, receiptPolling } = options;
  const { connector, account, currentConfig } = useAztecWallet();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const writeContract = useCallback(
    async <
      TContract extends ContractBase,
      TMethod extends MethodsOf<TContract> = MethodsOf<TContract>,
    >(
      params: WriteContractParams<TContract, TMethod>
    ): Promise<WriteContractResult> => {
      const {
        contract,
        address,
        functionName,
        args,
        feePaymentMethod = DEFAULT_FEE_PAYMENT_METHOD,
      } = params;
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

          const caipAccount = connector.getCaipAccount();
          if (!caipAccount || !response.txHash) {
            return {
              success: true,
              txHash: response.txHash,
              data: response.rawResult,
            };
          }

          const chain = getChainFromCaipAccount(caipAccount);
          const receiptResult = await waitForBrowserWalletReceipt(
            connector,
            response.txHash,
            chain,
            receiptPolling
          );

          if (receiptResult.success === false) {
            setError(receiptResult.error);
            return {
              success: false,
              error: receiptResult.error,
              txHash: response.txHash,
            };
          }

          return {
            success: true,
            txHash: response.txHash,
            data: response.rawResult,
          };
        }

        // Handle both Embedded and External Signer connectors (both have app-managed PXE)
        if (hasAppManagedPXE(connector)) {
          const wallet = connector.getWallet();
          if (!wallet) {
            const errorMsg = 'Wallet instance not available';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          // Get fee payment method from global store
          const paymentMethod = await createFeePaymentMethod(feePaymentMethod, {
            config: currentConfig?.feePaymentContracts ?? {},
            getSponsoredFeePaymentMethod: () =>
              connector.getSponsoredFeePaymentMethod(),
          });

          const contractAddress = AztecAddress.fromString(address);

          // Create contract instance
          const contract = await Contract.at(contractAddress, artifact, wallet);

          // Get the method and call it
          const method = (
            contract as unknown as {
              methods: Record<string, (...args: unknown[]) => unknown>;
            }
          ).methods[String(functionName)];

          if (!method) {
            const errorMsg = `Method ${String(functionName)} not found on contract`;
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const tx = method(...(args as unknown[]));

          // Simulate first to catch revert reasons before sending
          console.log(
            `[useWriteContract] Simulating ${String(functionName)}...`
          );
          try {
            const simulateResult = await (
              tx as { simulate: (opts: unknown) => Promise<unknown> }
            ).simulate({ from: account.getAddress() });
            console.log(
              `[useWriteContract] Simulation successful:`,
              simulateResult
            );
          } catch (simErr) {
            const simErrorMsg =
              simErr instanceof Error ? simErr.message : 'Simulation failed';
            console.error(
              `[useWriteContract] Simulation failed for ${String(functionName)}:`,
              simErr
            );
            setError(simErrorMsg);
            return {
              success: false,
              error: `Simulation failed: ${simErrorMsg}`,
            };
          }

          const sentTx = (
            tx as {
              send: (opts: unknown) => {
                wait: (opts: unknown) => Promise<unknown>;
              };
            }
          ).send({
            from: account.getAddress(),
            fee: { paymentMethod },
          });

          const result = await sentTx.wait({ timeout });

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
    [
      connector,
      account,
      timeout,
      currentConfig?.feePaymentContracts,
      receiptPolling,
    ]
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
