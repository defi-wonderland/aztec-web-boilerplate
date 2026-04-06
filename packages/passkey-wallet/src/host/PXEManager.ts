import { EPHEMERAL_STORE_NAMES } from '../shared/constants';
import { CompositeKVStore } from '../storage/CompositeKVStore';
import { InMemoryKVStore } from '../storage/InMemoryKVStore';
import { EncryptedKVStore } from './EncryptedKVStore';

export class PXEManager {
  private pxe: any | null = null;
  private ramStore: InMemoryKVStore | null = null;

  async initialize(node: any, encryptionKey: CryptoKey): Promise<any> {
    // Use lazy PXE creator — defers BB WASM/prover initialization until
    // a proof is actually needed. The bundle creator eagerly initializes
    // BB Workers which hang in credentialless iframes (no SharedArrayBuffer).
    const { createPXE } = await import('@aztec/pxe/client/lazy');
    const { AztecIndexedDBStore } = await import('@aztec/kv-store/indexeddb');
    const { createLogger } = await import('@aztec/foundation/log');

    this.ramStore = new InMemoryKVStore();

    const storeLogger = createLogger('passkey-wallet:store');
    const rawIndexedDB = await AztecIndexedDBStore.open(
      storeLogger,
      'passkey-wallet-pxe',
      false,
    );
    const encryptedStore = new EncryptedKVStore(rawIndexedDB, encryptionKey);
    const compositeStore = new CompositeKVStore(encryptedStore, this.ramStore, EPHEMERAL_STORE_NAMES);

    console.log('[PXEManager] Creating PXE (lazy)...');
    this.pxe = await createPXE(node, {}, { store: compositeStore });
    console.log('[PXEManager] PXE created!');
    return this.pxe;
  }

  getPXE(): any | null {
    return this.pxe;
  }

  async destroy(): Promise<void> {
    if (this.pxe) {
      await this.pxe.stop();
      this.pxe = null;
    }
    if (this.ramStore) {
      await this.ramStore.clear();
      this.ramStore = null;
    }
  }
}
