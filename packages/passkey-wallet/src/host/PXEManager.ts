import { EPHEMERAL_STORE_NAMES } from '../shared/constants';
import { CompositeKVStore } from '../storage/CompositeKVStore';
import { InMemoryKVStore } from '../storage/InMemoryKVStore';
import { EncryptedKVStore } from './EncryptedKVStore';

export class PXEManager {
  private pxe: any | null = null;
  private ramStore: InMemoryKVStore | null = null;

  async initialize(node: any, encryptionKey: CryptoKey): Promise<any> {
    const { createPXE } = await import('@aztec/pxe/client/bundle');
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

    this.pxe = await createPXE(node, {}, { store: compositeStore });
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
