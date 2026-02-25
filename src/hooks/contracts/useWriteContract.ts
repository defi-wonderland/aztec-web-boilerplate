import { useMutation } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, type ContractBase } from '@aztec/aztec.js/contracts';
import { TxStatus } from '@aztec/stdlib/tx';
import {
  useAztecWallet,
  isBrowserWalletConnector,
  hasAppManagedPXE,
} from '../../aztec-wallet';
import { createFeePaymentMethod } from '../../services/aztec/feePayment';
import { DEFAULT_FEE_PAYMENT_METHOD } from '../../store/feePayment';
import { getChainFromCaipAccount } from '../../utils/caip';
import { waitForBrowserWalletReceipt } from '../../utils/txReceipt';
import { getContractMethod } from './utils';
import type {
  MethodsOf,
  WriteContractData,
  WriteContractMutateParams,
  UseWriteContractOptions,
  UseWriteContractReturn,
} from '../../types/contractTypes';

/**
 * Hook for executing write operations on Aztec contracts.
 * Wraps React Query's `useMutation` to provide wagmi-like ergonomics.
 *
 * Returns `writeContract` (fire-and-forget) and `writeContractAsync` (awaitable)
 * along with mutation state (`isPending`, `isError`, `error`, `data`, etc.).
 *
 * @example
 * ```tsx
 * const { writeContract, writeContractAsync, isPending, isError, error, data, reset } =
 *   useWriteContract({ onSuccess, onError });
 *
 * // Fire-and-forget (errors land in isError/error)
 * writeContract({
 *   contract: DripperContract,
 *   address: dripperAddress,
 *   functionName: 'drip_to_private',
 *   args: [tokenAddress, amount],
 * });
 *
 * // Or awaitable
 * const result = await writeContractAsync({ ... });
 * ```
 */
export const useWriteContract = (
  options: UseWriteContractOptions = {}
): UseWriteContractReturn => {
  const {
    timeout = 900,
    receiptPolling,
    onSuccess,
    onError,
    onSettled,
  } = options;
  const { connector, account, currentConfig } = useAztecWallet();

  const mutation = useMutation<
    WriteContractData,
    Error,
    WriteContractMutateParams<ContractBase, string>
  >({
    mutationFn: async (params) => {
      const {
        address,
        functionName,
        args,
        feePaymentMethod = DEFAULT_FEE_PAYMENT_METHOD,
      } = params;
      const artifact = params.contract.artifact;

      if (!connector || !account) {
        throw new Error('Wallet not connected');
      }

      // ========== BROWSER WALLET FLOW ==========
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
          throw new Error(response.error ?? 'Transaction failed');
        }

        const caipAccount = connector.getCaipAccount();
        if (!caipAccount || !response.txHash) {
          return {
            txHash: response.txHash,
            result: response.rawResult,
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
          throw new Error(receiptResult.error);
        }

        return {
          txHash: response.txHash,
          result: response.rawResult,
        };
      }

      // ========== APP-MANAGED PXE FLOW (Embedded + External Signer) ==========
      if (hasAppManagedPXE(connector)) {
        const wallet = connector.getWallet();
        if (!wallet) {
          throw new Error('Wallet instance not available');
        }

        const paymentMethod = await createFeePaymentMethod(feePaymentMethod, {
          config: currentConfig?.feePaymentContracts ?? {},
          getSponsoredFeePaymentMethod: () =>
            connector.getSponsoredFeePaymentMethod(),
        });

        const contractAddress = AztecAddress.fromString(address);
        const contractInstance = Contract.at(contractAddress, artifact, wallet);

        const method = getContractMethod(
          contractInstance,
          String(functionName)
        );
        if (!method) {
          throw new Error(
            `Method ${String(functionName)} not found on contract`
          );
        }

        const tx = method(...(args as unknown[]));

        // Simulate first to catch revert reasons before sending
        console.log(`[useWriteContract] Simulating ${String(functionName)}...`);
        try {
          const simulateResult = await tx.simulate({
            from: account.getAddress(),
          });
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
          throw new Error(`Simulation failed: ${simErrorMsg}`);
        }

        const result = await tx.send({
          from: account.getAddress(),
          ...(paymentMethod ? { fee: { paymentMethod } } : {}),
          wait: { timeout, waitForStatus: TxStatus.PROPOSED },
        });

        return { result };
      }

      throw new Error('Unknown wallet type');
    },
    onSuccess,
    onError,
    onSettled,
  });

  const writeContract = <T extends ContractBase, M extends MethodsOf<T>>(
    params: WriteContractMutateParams<T, M>
  ): void => {
    mutation.mutate(
      params as unknown as WriteContractMutateParams<ContractBase, string>
    );
  };

  const writeContractAsync = <T extends ContractBase, M extends MethodsOf<T>>(
    params: WriteContractMutateParams<T, M>
  ): Promise<WriteContractData> => {
    return mutation.mutateAsync(
      params as unknown as WriteContractMutateParams<ContractBase, string>
    );
  };

  return {
    writeContract,
    writeContractAsync,
    data: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    isIdle: mutation.isIdle,
    status: mutation.status,
    reset: mutation.reset,
  };
};
