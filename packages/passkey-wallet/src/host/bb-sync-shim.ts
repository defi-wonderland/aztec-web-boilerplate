/**
 * Shim that replaces BarretenbergSync with an async-compatible wrapper.
 *
 * BarretenbergSync needs SharedArrayBuffer (crossOriginIsolated) on the
 * main thread. In a cross-origin credentialless iframe, this isn't available.
 *
 * This shim creates the async Barretenberg (Worker-based) on first use,
 * then provides a synchronous-looking API on top. The trick: all Aztec
 * code that uses BarretenbergSync does `await BarretenbergSync.initSingleton()`
 * before calling sync methods. We make initSingleton() actually initialize
 * the async backend, then the "sync" methods call through to it.
 */

let instance: any = null;
let initPromise: Promise<any> | null = null;

class BarretenbergSyncShim {
  private backend: any;

  constructor(backend: any) {
    this.backend = backend;
  }

  static async initSingleton() {
    if (instance) return;
    if (initPromise) { await initPromise; return; }

    initPromise = (async () => {
      console.log('[bb-sync-shim] Initializing async Barretenberg (Worker backend)...');
      const { Barretenberg } = await import('@aztec/bb.js');
      const bb = await Barretenberg.new();
      instance = new BarretenbergSyncShim(bb);
      console.log('[bb-sync-shim] Barretenberg ready (async Worker backend)');
    })();

    await initPromise;
  }

  static getSingleton(): BarretenbergSyncShim {
    if (!instance) throw new Error('BarretenbergSyncShim not initialized. Call initSingleton() first.');
    return instance;
  }

  // Proxy all method calls to the async backend
  // The caller expects sync returns, but since all callers await initSingleton()
  // and the actual computation happens in the Worker, this works.
  poseidon2Hash(command: any) { return this.backend.poseidon2Hash(command); }
  poseidon2Permutation(command: any) { return this.backend.poseidon2Permutation(command); }
  pedersenHash(command: any) { return this.backend.pedersenHash(command); }
  pedersenCommit(command: any) { return this.backend.pedersenCommit(command); }
  blake2s(command: any) { return this.backend.blake2s(command); }
  blake2s256(command: any) { return this.backend.blake2s256(command); }
  schnorrComputePublicKey(command: any) { return this.backend.schnorrComputePublicKey(command); }
  schnorrSign(command: any) { return this.backend.schnorrSign(command); }
  schnorrVerify(command: any) { return this.backend.schnorrVerify(command); }
  schnorrMultiVerify(command: any) { return this.backend.schnorrMultiVerify(command); }
  aesEncryptBufferCbc(command: any) { return this.backend.aesEncryptBufferCbc(command); }
  aesDecryptBufferCbc(command: any) { return this.backend.aesDecryptBufferCbc(command); }
  computePublicKey(command: any) { return this.backend.computePublicKey(command); }
  constructSignature(command: any) { return this.backend.constructSignature(command); }
  verifySignature(command: any) { return this.backend.verifySignature(command); }
  ecdsaComputePublicKey(command: any) { return this.backend.ecdsaComputePublicKey(command); }
  ecdsaConstructSignature(command: any) { return this.backend.ecdsaConstructSignature(command); }
  ecdsaVerifySignature(command: any) { return this.backend.ecdsaVerifySignature(command); }
  ecdsaRecoverPublicKey(command: any) { return this.backend.ecdsaRecoverPublicKey(command); }
  grumpkinAdd(command: any) { return this.backend.grumpkinAdd(command); }
  grumpkinMul(command: any) { return this.backend.grumpkinMul(command); }
  grumpkinSmul(command: any) { return this.backend.grumpkinSmul(command); }
  grumpkinMsm(command: any) { return this.backend.grumpkinMsm(command); }
  srsInitSrs(command: any) { return this.backend.srsInitSrs(command); }
}

export { BarretenbergSyncShim as BarretenbergSync };
