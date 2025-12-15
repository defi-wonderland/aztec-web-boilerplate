import { useState, useCallback } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, type ContractBase } from '@aztec/aztec.js/contracts';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { CaipChain } from '@azguardwallet/types';
import { useUniversalWallet } from '../context/useUniversalWallet';
import {
  isEmbeddedConnector,
  isBrowserWalletConnector,
  type BrowserWalletConnector,
} from '../../types/walletConnector';
import type {
  MethodsOf,
  ArgsOf,
  WriteContractResult,
} from '../../types/contractTypes';
import { getContractMethod } from './utils';

/** Default polling settings for browser wallet receipt */
const RECEIPT_POLL_INTERVAL_MS = 2000;
const RECEIPT_MAX_ATTEMPTS = 30; // 60 seconds total

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

const getChainFromCaipAccount = (caipAccount: string): string => {
  const parts = caipAccount.split(':');
  return `${parts[0]}:${parts[1]}`;
};

const waitForBrowserWalletReceipt = async (
  connector: BrowserWalletConnector,
  txHash: string,
  chain: string,
  options: { intervalMs?: number; maxAttempts?: number } = {}
): Promise<{ success: true } | { success: false; error: string }> => {
  const intervalMs = options.intervalMs ?? RECEIPT_POLL_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? RECEIPT_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await connector.executeOperation(
        { kind: 'aztec_getTxReceipt', chain: chain as CaipChain, txHash }
      );

      if (result.status === 'failed') {
        const errorMsg = 'error' in result ? String(result.error) : 'Failed to get receipt';
        return { success: false, error: errorMsg };
      }

      if (result.status === 'ok' && result.result) {
        const receipt = result.result as { status?: string };
        const txStatus = receipt.status?.toLowerCase();

        if (txStatus === 'mined' || txStatus === 'success') {
          return { success: true };
        }

        if (txStatus === 'dropped' || txStatus === 'failed' || txStatus === 'reverted') {
          return { success: false, error: `Transaction ${txStatus}` };
        }

      }
    } catch {
      // Network error - continue polling
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return { success: false, error: 'Transaction confirmation timeout' };
};

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
  const { timeout = 900, receiptPolling } = options;
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
          const caipAccount = connector.getCaipAccount();
          if (!caipAccount) {
            const errorMsg = 'No account selected';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

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

          if (!response.txHash) {
            const errorMsg = 'Transaction submitted but no txHash returned';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const chain = getChainFromCaipAccount(caipAccount);
          const receiptResult = await waitForBrowserWalletReceipt(
            connector,
            response.txHash,
            chain,
            receiptPolling
          );

          if (!receiptResult.success) {
            setError(receiptResult.error);
            return { success: false, error: receiptResult.error, txHash: response.txHash };
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
          
          const method = getContractMethod(contract, String(functionName));
          if (!method) {
            const errorMsg = `Method ${String(functionName)} not found on contract`;
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          // Cast safe: args validated by ArgsOf<TContract, TMethod> at call site
          const sentTx = method(...(args as unknown[])).send({
            from: account.getAddress(),
            fee: { paymentMethod },
          });

          // Get txHash before waiting (available immediately after send)
          const txHash = (await sentTx.getTxHash()).toString();
          const result = await sentTx.wait({ timeout });

          return {
            success: true,
            txHash,
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
    [connector, account, timeout, receiptPolling]
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
