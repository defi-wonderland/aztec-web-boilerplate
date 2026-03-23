/**
 * Core write execution for both wallet modes.
 *
 * Pure async functions — no React dependency.
 */

import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecAddress as AztecAddressType } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { TxStatus } from '@aztec/stdlib/tx';
import { getChainFromCaipAccount } from './utils/caip';
import { getContractMethod } from './utils/getContractMethod';
import { serializeArgs } from './utils/serializeArgs';
import { waitForReceipt } from './utils/txReceipt';
import type { WriteContractData } from '../../use-aztec/types/contractTypes';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../types/browserWallet';

// =============================================================================
// Browser Wallet Write
// =============================================================================

export interface BrowserWalletWriteParams {
  sendTransaction: (
    request: ConnectorTransactionRequest
  ) => Promise<ConnectorTransactionResult>;
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>;
  getCaipAccount: () => string | null;
  address: string;
  functionName: string;
  args: unknown[];
  receiptPolling?: { intervalMs?: number; maxAttempts?: number };
}

/**
 * Executes a contract write via browser wallet.
 */
export const executeBrowserWalletWrite = async (
  params: BrowserWalletWriteParams
): Promise<WriteContractData> => {
  const {
    sendTransaction,
    executeOperation,
    getCaipAccount,
    address,
    functionName,
    args,
    receiptPolling,
  } = params;

  const response = await sendTransaction({
    actions: [
      {
        contract: address,
        method: functionName,
        args: serializeArgs(args),
      },
    ],
  });

  if (response.status !== 'success') {
    throw new Error(response.error ?? 'Transaction failed');
  }

  const caipAccount = getCaipAccount();
  if (!caipAccount || !response.txHash) {
    return {
      txHash: response.txHash,
      result: response.rawResult,
    };
  }

  const chain = getChainFromCaipAccount(caipAccount);
  const receiptResult = await waitForReceipt({
    executeOperation,
    txHash: response.txHash,
    chain,
    ...receiptPolling,
  });

  if (receiptResult.success === false) {
    throw new Error(receiptResult.error);
  }

  return {
    txHash: response.txHash,
    result: response.rawResult,
  };
};

// =============================================================================
// App-Managed Write
// =============================================================================

export interface AppManagedWriteParams {
  wallet: Wallet;
  fromAddress: AztecAddressType;
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: unknown[];
  createFeePaymentMethod: (
    feePaymentMethod?: unknown
  ) => Promise<FeePaymentMethod | undefined>;
  feePaymentMethod?: unknown;
  timeout?: number;
}

/**
 * Executes a contract write via app-managed PXE wallet.
 */
export const executeAppManagedWrite = async (
  params: AppManagedWriteParams
): Promise<WriteContractData> => {
  const {
    wallet,
    fromAddress,
    artifact,
    address,
    functionName,
    args,
    createFeePaymentMethod,
    feePaymentMethod,
    timeout,
  } = params;

  const paymentMethod = await createFeePaymentMethod(feePaymentMethod);

  const contractAddress = AztecAddress.fromString(address);
  const contractInstance = Contract.at(contractAddress, artifact, wallet);

  const method = getContractMethod(contractInstance, functionName);
  if (!method) {
    throw new Error(`Method ${functionName} not found on contract`);
  }

  const tx = method(...args);
  try {
    await tx.simulate({ from: fromAddress });
  } catch (simErr) {
    const simErrorMsg =
      simErr instanceof Error ? simErr.message : 'Simulation failed';
    throw new Error(`Simulation failed: ${simErrorMsg}`);
  }

  const result = await tx.send({
    from: fromAddress,
    ...(paymentMethod ? { fee: { paymentMethod } } : {}),
    wait: { timeout: timeout ?? 900, waitForStatus: TxStatus.PROPOSED },
  });

  return { result };
};
