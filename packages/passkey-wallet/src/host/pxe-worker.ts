/**
 * PXE Web Worker entry point.
 *
 * Runs inside the wallet host iframe's Worker context, which has
 * crossOriginIsolated=true and SharedArrayBuffer even when the
 * iframe's main thread does not (credentialless iframe).
 *
 * Handles:
 * - PXE initialization (createPXE, BarretenbergSync, CompositeKVStore)
 * - Account registration (deriveKeys via native poseidon2Hash)
 * - All PXE method calls forwarded from the main thread
 *
 * Message protocol:
 *   Main -> Worker: { type: 'init', nodeUrl, encryptionKeyRaw, masterSecret, accountSalt, contracts }
 *   Main -> Worker: { type: 'call', id, method, params }
 *   Main -> Worker: { type: 'destroy' }
 *   Worker -> Main: { type: 'init-result', success, address?, error? }
 *   Worker -> Main: { type: 'call-result', id, success, result?, error? }
 *   Worker -> Main: { type: 'destroy-result', success }
 */

// Self-reference typed as a Worker global scope
declare const self: DedicatedWorkerGlobalScope;

let pxe: any = null;

// ---------------------------------------------------------------------------
// Init handler
// ---------------------------------------------------------------------------

async function handleInit(data: {
  nodeUrl: string;
  encryptionKeyRaw: number[];
  masterSecret: string;
  accountSalt: string;
  contracts: any[];
}): Promise<{ address: string }> {
  const { createPXE } = await import('@aztec/pxe/client/lazy');
  const { AztecIndexedDBStore } = await import('@aztec/kv-store/indexeddb');
  const { createLogger } = await import('@aztec/foundation/log');
  const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
  const { Fr } = await import('@aztec/foundation/curves/bn254');

  // These are our own modules bundled into the worker
  const { CompositeKVStore } = await import('../storage/CompositeKVStore');
  const { InMemoryKVStore } = await import('../storage/InMemoryKVStore');
  const { EncryptedKVStore } = await import('./EncryptedKVStore');
  const { EPHEMERAL_STORE_NAMES } = await import('../shared/constants');

  // Import encryption key from raw bytes (CryptoKey is not transferable)
  const keyBytes = new Uint8Array(data.encryptionKeyRaw);
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );

  // Create stores
  const ramStore = new InMemoryKVStore();
  const storeLogger = createLogger('passkey-wallet:store');
  const rawIndexedDB = await AztecIndexedDBStore.open(
    storeLogger,
    'passkey-wallet-pxe',
    false,
  );
  const encryptedStore = new EncryptedKVStore(rawIndexedDB, encryptionKey);
  const compositeStore = new CompositeKVStore(encryptedStore, ramStore, EPHEMERAL_STORE_NAMES);

  // Create Aztec node client
  console.log('[pxe-worker] Creating node client for', data.nodeUrl);
  const node = createAztecNodeClient(data.nodeUrl);

  // Create PXE (lazy — defers prover download until needed)
  console.log('[pxe-worker] Creating PXE (lazy)...');
  pxe = await createPXE(node, {}, { store: compositeStore });
  console.log('[pxe-worker] PXE created!');

  // Register account
  const secretKey = new Fr(BigInt(data.masterSecret));
  await pxe.registerAccount(secretKey, Fr.ZERO);

  // Register contracts
  for (const config of data.contracts) {
    await pxe.registerContract({ instance: config, artifact: config.artifact });
  }

  // Get registered address
  const accounts = await pxe.getRegisteredAccounts();
  const address = accounts[0]?.address?.toString() ?? 'unknown';
  console.log('[pxe-worker] Account registered:', address);

  return { address };
}

// ---------------------------------------------------------------------------
// Call handler
// ---------------------------------------------------------------------------

async function handleCall(method: string, params: unknown[]): Promise<unknown> {
  if (!pxe) throw new Error('PXE not initialized. Call init first.');
  if (typeof (pxe as any)[method] !== 'function') {
    throw new Error(`Unknown PXE method: ${method}`);
  }
  return (pxe as any)[method](...params);
}

// ---------------------------------------------------------------------------
// Destroy handler
// ---------------------------------------------------------------------------

async function handleDestroy(): Promise<void> {
  if (pxe) {
    await pxe.stop();
    pxe = null;
  }
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent) => {
  const data = event.data;

  if (data.type === 'init') {
    try {
      const result = await handleInit(data);
      self.postMessage({ type: 'init-result', success: true, address: result.address });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[pxe-worker] Init failed:', err);
      self.postMessage({ type: 'init-result', success: false, error: message });
    }
    return;
  }

  if (data.type === 'call') {
    try {
      const result = await handleCall(data.method, data.params);
      self.postMessage({ type: 'call-result', id: data.id, success: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pxe-worker] Call ${data.method} failed:`, err);
      self.postMessage({ type: 'call-result', id: data.id, success: false, error: message });
    }
    return;
  }

  if (data.type === 'destroy') {
    try {
      await handleDestroy();
      self.postMessage({ type: 'destroy-result', success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[pxe-worker] Destroy failed:', err);
      self.postMessage({ type: 'destroy-result', success: true }); // best-effort
    }
    return;
  }
};
