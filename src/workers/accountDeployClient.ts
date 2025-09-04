import type { DeployEcdsaAccountPayload, WorkerResponse } from './messages';

export type DeployCallbacks = {
  onSuccess?: (payload: WorkerResponse & { type: 'deployed' }) => void;
  onError?: (error: string) => void;
};

export class AccountDeployWorkerClient {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('./accountDeploy.worker.ts', import.meta.url), { type: 'module' });
  }

  deploy(payload: DeployEcdsaAccountPayload, callbacks?: DeployCallbacks) {
    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data as WorkerResponse;
      if (data.type === 'error') {
        callbacks?.onError?.(data.error);
        this.worker.terminate();
        return;
      }
      if (data.type === 'deployed') {
        callbacks?.onSuccess?.(data as any);
        this.worker.terminate();
      }
    };
    this.worker.onerror = (err) => {
      callbacks?.onError?.(err.message);
      this.worker.terminate();
    };
    this.worker.postMessage({ type: 'deployEcdsaAccount', payload });
  }
}


