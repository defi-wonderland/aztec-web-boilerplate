import { useCallback, useState } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { useUniversalWallet } from '../context/useUniversalWallet';
import {
  hasAppManagedPXE,
  isBrowserWalletConnector,
  type BrowserWalletConnector,
} from '../../types/walletConnector';
import { getContractMethod } from './utils';
import type { SimulateViewsOp } from '../../types';

interface CallParams {
  address: string;
  functionName: string;
  args: unknown[];
}

interface CallResult {
  success: boolean;
  data?: unknown;
  txHash?: string;
  error?: string;
}

const RECEIPT_POLL_INTERVAL_MS = 2000;
const RECEIPT_MAX_ATTEMPTS = 30;

const waitForBrowserWalletReceipt = async (
  connector: BrowserWalletConnector,
  txHash: string,
  chain: string
): Promise<{ success: true } | { success: false; error: string }> => {
  for (let attempt = 1; attempt <= RECEIPT_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await connector.executeOperation({
        kind: 'aztec_getTxReceipt',
        chain,
        txHash,
      });

      if (result.status === 'failed') {
        const errorMsg = 'error' in result && result.error ? String(result.error) : 'Failed to fetch receipt';
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
      // swallow transient errors and continue polling
    }

    if (attempt < RECEIPT_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RECEIPT_POLL_INTERVAL_MS));
    }
  }

  return { success: false, error: 'Transaction confirmation timeout' };
};

export const useDynamicContractCaller = (artifact?: ContractArtifact | null) => {
  const { connector, account } = useUniversalWallet();
  const [isSimulating, setIsSimulating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = useCallback(
    async (params: CallParams): Promise<CallResult> => {
      const { address, functionName, args } = params;

      if (!connector || !account) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsSimulating(true);
      setError(null);

      try {
        if (isBrowserWalletConnector(connector)) {
          const selectedAccount = connector.getCaipAccount?.();
          if (!selectedAccount) {
            return { success: false, error: 'Browser wallet account not selected' };
          }

          const operation: SimulateViewsOp = {
            kind: 'simulate_views',
            account: selectedAccount,
            calls: [
              {
                kind: 'call',
                contract: address,
                method: functionName,
                args,
              },
            ],
          };

          const result = await connector.executeOperation(operation);

          if (result.status !== 'ok') {
            const errorMsg = 'error' in result && result.error ? String(result.error) : 'Simulation failed';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          return { success: true, data: result.result };
        }

        if (hasAppManagedPXE(connector)) {
          if (!artifact) {
            return { success: false, error: 'Artifact not loaded' };
          }

          const wallet = connector.getWallet();
          if (!wallet) {
            return { success: false, error: 'Wallet instance not available' };
          }

          const contractAddress = AztecAddress.fromString(address);
          const contract = await Contract.at(contractAddress, artifact, wallet);
          const method = getContractMethod(contract, functionName);

          if (!method) {
            return { success: false, error: `Method ${functionName} not found` };
          }

          const result = await method(...args).simulate({
            from: account.getAddress(),
          });

          return { success: true, data: result };
        }

        return { success: false, error: 'Unsupported connector type' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsSimulating(false);
      }
    },
    [account, artifact, connector]
  );

  const execute = useCallback(
    async (params: CallParams): Promise<CallResult> => {
      const { address, functionName, args } = params;

      if (!connector || !account) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsExecuting(true);
      setError(null);

      try {
        if (isBrowserWalletConnector(connector)) {
          const response = await connector.sendTransaction({
            actions: [
              {
                contract: address,
                method: functionName,
                args: args.map((arg) => (typeof arg === 'bigint' ? arg.toString() : arg)),
              },
            ],
          });

          if (response.status !== 'success') {
            const errorMsg = response.error ?? 'Transaction failed';
            setError(errorMsg);
            return { success: false, error: errorMsg };
          }

          const caipAccount = connector.getCaipAccount?.();
          if (!caipAccount || !response.txHash) {
            return {
              success: true,
              txHash: response.txHash,
              data: response.rawResult,
            };
          }

          const chain = `${caipAccount.split(':')[0]}:${caipAccount.split(':')[1]}`;
          const receipt = await waitForBrowserWalletReceipt(connector, response.txHash, chain);

          if (!receipt.success) {
            const errorMsg = receipt.error ?? 'Transaction confirmation failed';
            setError(errorMsg);
            return { success: false, error: errorMsg, txHash: response.txHash };
          }

          return {
            success: true,
            txHash: response.txHash,
            data: response.rawResult,
          };
        }

        if (hasAppManagedPXE(connector)) {
          if (!artifact) {
            return { success: false, error: 'Artifact not loaded' };
          }

          const wallet = connector.getWallet();
          if (!wallet) {
            return { success: false, error: 'Wallet instance not available' };
          }

          const contractAddress = AztecAddress.fromString(address);
          const contract = await Contract.at(contractAddress, artifact, wallet);
          const method = getContractMethod(contract, functionName);

          if (!method) {
            return { success: false, error: `Method ${functionName} not found` };
          }

          const paymentMethod = await connector.getSponsoredFeePaymentMethod();
          const tx = method(...args);
          const sentTx = tx.send({
            from: account.getAddress(),
            fee: { paymentMethod },
          });
          const receipt = await sentTx.wait({ timeout: 900 });

          return { success: true, data: receipt };
        }

        return { success: false, error: 'Unsupported connector type' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsExecuting(false);
      }
    },
    [account, artifact, connector]
  );

  return {
    simulate,
    execute,
    isSimulating,
    isExecuting,
    error,
  };
};
