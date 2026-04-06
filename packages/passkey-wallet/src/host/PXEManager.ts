/**
 * Manages the PXE Web Worker.
 *
 * Instead of creating the PXE on the iframe's main thread (which lacks
 * SharedArrayBuffer in credentialless iframes), we spawn a Worker that
 * has crossOriginIsolated=true and can use BarretenbergSync natively.
 *
 * The main thread communicates with the Worker via postMessage using a
 * simple request/response protocol with correlation IDs.
 */
export class PXEManager {
  private worker: Worker | null = null;
  private pendingInit: { resolve: (address: string) => void; reject: (err: Error) => void } | null = null;
  private pendingCalls = new Map<string, { resolve: (result: unknown) => void; reject: (err: Error) => void }>();
  private pendingDestroy: { resolve: () => void; reject: (err: Error) => void } | null = null;
  private initialized = false;

  /**
   * Spawn the PXE Worker and initialize PXE + register account inside it.
   *
   * @param nodeUrl - Aztec node URL
   * @param encryptionKeyRaw - Raw AES-256 key bytes (CryptoKey is not transferable)
   * @param masterSecret - Master secret as bigint string
   * @param accountSalt - Account salt as bigint string
   * @param contracts - Contract configs to register
   * @returns The registered account address
   */
  async initialize(
    nodeUrl: string,
    encryptionKeyRaw: Uint8Array,
    masterSecret: string,
    accountSalt: string,
    contracts: any[],
  ): Promise<string> {
    if (this.worker) {
      throw new Error('PXE Worker already initialized. Call destroy() first.');
    }

    // Create Worker from the co-located built worker file
    this.worker = new Worker(new URL('./pxe-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
    this.worker.onerror = (e) => {
      console.error('[PXEManager] Worker error:', e);
      // Reject any pending init
      if (this.pendingInit) {
        this.pendingInit.reject(new Error(`Worker error: ${e.message}`));
        this.pendingInit = null;
      }
    };

    return new Promise<string>((resolve, reject) => {
      this.pendingInit = { resolve, reject };
      this.worker!.postMessage({
        type: 'init',
        nodeUrl,
        encryptionKeyRaw: Array.from(encryptionKeyRaw),
        masterSecret,
        accountSalt,
        contracts,
      });
    });
  }

  /**
   * Forward a PXE method call to the Worker.
   */
  async callPXE(method: string, params: unknown[]): Promise<unknown> {
    if (!this.worker || !this.initialized) {
      throw new Error('PXE not initialized. Call initialize() first.');
    }

    const id = crypto.randomUUID();
    return new Promise<unknown>((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'call', id, method, params });
    });
  }

  /**
   * Whether the PXE Worker is initialized and ready.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Tear down the PXE Worker.
   */
  async destroy(): Promise<void> {
    if (!this.worker) return;

    // Ask the worker to clean up PXE
    try {
      await new Promise<void>((resolve, reject) => {
        this.pendingDestroy = { resolve, reject };
        this.worker!.postMessage({ type: 'destroy' });
        // Timeout — don't hang if worker is stuck
        setTimeout(() => {
          if (this.pendingDestroy) {
            this.pendingDestroy.resolve();
            this.pendingDestroy = null;
          }
        }, 5000);
      });
    } catch {
      // Best-effort cleanup
    }

    this.worker.terminate();
    this.worker = null;
    this.initialized = false;
    this.pendingCalls.clear();
  }

  // ---------------------------------------------------------------------------
  // Worker message handler
  // ---------------------------------------------------------------------------

  private handleWorkerMessage(data: any): void {
    if (data.type === 'init-result') {
      if (!this.pendingInit) return;
      if (data.success) {
        this.initialized = true;
        this.pendingInit.resolve(data.address);
      } else {
        this.pendingInit.reject(new Error(data.error));
      }
      this.pendingInit = null;
      return;
    }

    if (data.type === 'call-result') {
      const pending = this.pendingCalls.get(data.id);
      if (!pending) return;
      this.pendingCalls.delete(data.id);
      if (data.success) {
        pending.resolve(data.result);
      } else {
        pending.reject(new Error(data.error));
      }
      return;
    }

    if (data.type === 'destroy-result') {
      if (this.pendingDestroy) {
        this.pendingDestroy.resolve();
        this.pendingDestroy = null;
      }
      return;
    }
  }
}
