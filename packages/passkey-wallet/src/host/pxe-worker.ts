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
 * - Wallet method calls (BaseWallet with ECDSA-R signing)
 *
 * Message protocol:
 *   Main -> Worker: { type: 'init', nodeUrl, encryptionKeyRaw, masterSecret, accountSalt, signingKey, contracts }
 *   Main -> Worker: { type: 'call', id, method, params }
 *   Main -> Worker: { type: 'wallet-call', id, method, serializedArgs }
 *   Main -> Worker: { type: 'destroy' }
 *   Worker -> Main: { type: 'init-result', success, address?, error? }
 *   Worker -> Main: { type: 'call-result', id, success, result?, error? }
 *   Worker -> Main: { type: 'wallet-call-result', id, success, result?, error? }
 *   Worker -> Main: { type: 'destroy-result', success }
 */

// Self-reference typed as a Worker global scope
declare const self: DedicatedWorkerGlobalScope;

let pxe: any = null;
let wallet: any = null;

function log(msg: string) {
  console.log(msg);
  // Also relay to main thread so it can forward to parent
  self.postMessage({ type: 'log', message: msg });
}

// ---------------------------------------------------------------------------
// Init handler
// ---------------------------------------------------------------------------

async function handleInit(data: {
  nodeUrl: string;
  encryptionKeyRaw: number[];
  masterSecret: string;
  accountSalt: string;
  signingKey: number[];
  contracts: any[];
}): Promise<{ address: string }> {
  const { createPXE } = await import('@aztec/pxe/client/lazy');
  const { AztecIndexedDBStore } = await import('@aztec/kv-store/indexeddb');
  const { createLogger } = await import('@aztec/foundation/log');
  const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
  const { Fr } = await import('@aztec/foundation/curves/bn254');
  const { BaseWallet } = await import('@aztec/wallet-sdk/base-wallet');
  const { AccountManager } = await import('@aztec/aztec.js/wallet');

  // These are our own modules bundled into the worker
  const { CompositeKVStore } = await import('../storage/CompositeKVStore');
  const { InMemoryKVStore } = await import('../storage/InMemoryKVStore');
  const { EncryptedKVStore } = await import('./EncryptedKVStore');
  const { EPHEMERAL_STORE_NAMES } = await import('../shared/constants');
  const { createAccountContract } = await import('./AccountManager');

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
  log('[pxe-worker] crossOriginIsolated=' + self.crossOriginIsolated + ' SAB=' + (typeof SharedArrayBuffer !== 'undefined'));
  log('[pxe-worker] Creating node client for ' + data.nodeUrl);
  const node = createAztecNodeClient(data.nodeUrl);

  // Create PXE (lazy — defers prover download until needed)
  log('[pxe-worker] Creating PXE (lazy)...');
  pxe = await createPXE(node, {}, { store: compositeStore });
  log('[pxe-worker] PXE created!');

  // Create the account via AccountManager — this computes the correct address
  // from the secret key + account contract (ECDSA-R). Don't use raw pxe.registerAccount()
  // which produces a different address without the account contract.
  const secretKey = new Fr(BigInt(data.masterSecret));
  const signingKeyBytes = new Uint8Array(data.signingKey);
  const accountContract = createAccountContract(signingKeyBytes);
  const accountManager = await AccountManager.create(pxe as any, secretKey, accountContract, Fr.ZERO);

  // Register account contract + keys with PXE
  // (mirrors BaseWallet.registerContract logic: register contract, then registerAccount with partial address)
  const { computePartialAddress } = await import('@aztec/stdlib/contract');
  const account = await accountManager.getAccount();
  const accountInstance = accountManager.getInstance();
  const accountArtifact = await accountManager.getAccountContract().getContractArtifact();

  await pxe.registerContract({ instance: accountInstance, artifact: accountArtifact });
  const partialAddress = await computePartialAddress(accountInstance);
  await pxe.registerAccount(secretKey, partialAddress);

  const accountAddress = accountManager.address;
  log('[pxe-worker] Account registered: ' + accountAddress.toString());

  // Register contracts directly in the worker (bypasses WalletProxy serialization
  // which can't handle the complex ContractInstanceWithAddress Zod schemas).
  if (data.contracts && data.contracts.length > 0) {
    const { getContractInstanceFromInstantiationParams } = await import('@aztec/aztec.js/contracts');
    const { AztecAddress } = await import('@aztec/stdlib/aztec-address');
    const { deserializeContractConfig } = await import('../shared/contractSerialization');

    for (const c of data.contracts) {
      try {
        const deserialized = deserializeContractConfig(c, Fr, AztecAddress);

        const instance = await getContractInstanceFromInstantiationParams(
          deserialized.artifact,
          {
            salt: deserialized.salt,
            deployer: deserialized.deployer,
            constructorArtifact: deserialized.constructorArtifact ?? 'constructor',
            constructorArgs: deserialized.constructorArgs ?? [],
          },
        );

        await pxe.registerContract({ instance, artifact: deserialized.artifact });
        log(`[pxe-worker] Registered contract: ${instance.address.toString().slice(0, 14)}...`);
      } catch (err) {
        log(`[pxe-worker] Failed to register contract: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  class PasskeyWallet extends BaseWallet {
    constructor(pxeInstance: any, aztecNode: any, private account: any, private accountAddress: any) {
      super(pxeInstance, aztecNode);
    }

    protected async getAccountFromAddress(addr: any): Promise<any> {
      // Compare by string — addr may be a Zod-deserialized AztecAddress whose
      // .equals() fails against the AccountManager's address due to type mismatch.
      if (addr.toString() === this.accountAddress.toString() || addr.isZero()) {
        return this.account;
      }
      throw new Error(`Unknown account: ${addr.toString()}`);
    }

    async getAccounts(): Promise<Array<{ alias: string; item: any }>> {
      return [{ alias: '', item: this.accountAddress }];
    }
  }

  wallet = new PasskeyWallet(pxe, node, account, accountAddress);
  log('[pxe-worker] PasskeyWallet created for ' + address);

  return { address };
}

// ---------------------------------------------------------------------------
// Call handler (raw PXE methods)
// ---------------------------------------------------------------------------

async function handleCall(method: string, params: unknown[]): Promise<unknown> {
  if (!pxe) throw new Error('PXE not initialized. Call init first.');
  if (typeof (pxe as any)[method] !== 'function') {
    throw new Error(`Unknown PXE method: ${method}`);
  }
  return (pxe as any)[method](...params);
}

// ---------------------------------------------------------------------------
// Wallet call handler
// ---------------------------------------------------------------------------

async function handleWalletCall(method: string, serializedArgs: string): Promise<string> {
  if (!wallet) throw new Error('Wallet not initialized. Call init first.');

  const { jsonStringify } = await import('@aztec/foundation/json-rpc');
  const { WalletSchema } = await import('@aztec/aztec.js/wallet');

  // Deserialize args using the WalletSchema's parameter schemas
  const rawArgs = JSON.parse(serializedArgs);
  const schema = WalletSchema[method as keyof typeof WalletSchema];
  if (!schema || typeof schema.parameters !== 'function') {
    throw new Error(`Unknown wallet method: ${method}`);
  }

  // Parse args through the schema to reconstruct Aztec types
  const parsedArgs = await schema.parameters().parseAsync(rawArgs);

  // Call the actual wallet method
  const fn = (wallet as any)[method];
  if (typeof fn !== 'function') {
    throw new Error(`Wallet method not implemented: ${method}`);
  }
  const result = await fn.apply(wallet, parsedArgs);

  // Serialize the result with jsonStringify to handle Aztec types
  return jsonStringify(result);
}

// ---------------------------------------------------------------------------
// Destroy handler
// ---------------------------------------------------------------------------

async function handleDestroy(): Promise<void> {
  wallet = null;
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

  if (data.type === 'wallet-call') {
    try {
      const result = await handleWalletCall(data.method, data.serializedArgs);
      self.postMessage({ type: 'wallet-call-result', id: data.id, success: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pxe-worker] Wallet call ${data.method} failed:`, err);
      self.postMessage({ type: 'wallet-call-result', id: data.id, success: false, error: message });
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
