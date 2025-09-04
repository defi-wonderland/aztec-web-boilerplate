import { AccountDeployWorkerClient } from '../../../workers/accountDeployClient';
import type { CreateAccountResult } from '../../../types';
import type { MessageInfo } from '../../../providers/ErrorProvider';

export interface DeploymentCallbacks {
  onSuccess?: (txHash: string | null) => void;
  onError?: (error: string) => void;
}

/**
 * Service for handling Aztec account deployment operations
 */
export class AztecAccountDeployService {
  private deployWorker: AccountDeployWorkerClient | null = null;

  /**
   * Deploy an account in the background using a Web Worker
   */
  async deployAccount(
    nodeUrl: string,
    result: CreateAccountResult,
    callbacks?: DeploymentCallbacks
  ): Promise<void> {
    // Spawn worker client once per service lifecycle
    if (!this.deployWorker) {
      this.deployWorker = new AccountDeployWorkerClient();
    }

    // Deploy the account via worker, non-blocking
    this.deployWorker.deploy(
      {
        nodeUrl,
        secretKey: result.secretKey.toString(),
        signingKeyHex: result.signingKey.toString('hex'),
        salt: result.salt.toString(),
      },
      {
        onSuccess: (data) => {
          const txHash = data.payload.txHash;
          callbacks?.onSuccess?.(txHash);
        },
        onError: (errMessage) => {
          callbacks?.onError?.(errMessage);
        },
      }
    );
  }

  /**
   * Create message objects for deployment results
   */
  createSuccessMessage(txHash: string | null): Omit<MessageInfo, 'id' | 'timestamp'> {
    return {
      message: 'Account deployed successfully',
      type: 'success',
      source: 'wallet',
      details: txHash ? `Tx: ${txHash}` : undefined,
    };
  }

  createErrorMessage(errMessage: string): Omit<MessageInfo, 'id' | 'timestamp'> {
    return {
      message: 'Failed to deploy account in background',
      type: 'error',
      source: 'wallet',
      details: errMessage,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.deployWorker = null;
  }
}
