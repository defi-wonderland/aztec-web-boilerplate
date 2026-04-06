import type { SecureChannel } from '../shared/SecureChannel';
import type { PopupResponse } from '../shared/types';
import type { PXEManager } from './PXEManager';
import type { CredentialStore } from './CredentialStore';
import { fromBase64 } from '../shared/encoding';
import { Fr } from '@aztec/foundation/curves/bn254';

/**
 * Processes RPC messages from the SDK over the SecureChannel.
 *
 * - initWithKeys: receives passkey-derived keys, initializes PXE, registers account
 * - requestPopup: waits for popup result via BroadcastChannel (same origin as iframe)
 * - disconnect: tears down PXE
 * - All other methods: forwarded to the PXE instance
 */
export class RPCHandler {
  // TIER-2-UPGRADE: Remove signingKey field.
  private signingKey: Uint8Array | null = null;

  constructor(
    private pxeManager: PXEManager,
    private credentialStore: CredentialStore,
    private contractConfigs: any[],
    private nodeUrl: string,
  ) {}

  register(channel: SecureChannel): void {
    channel.onRequest(async (method, params) => {
      try {
        if (method === 'initWithKeys') return await this.handleInitWithKeys(params[0] as PopupResponse);
        if (method === 'disconnect') return await this.handleDisconnect();

        const pxe = this.pxeManager.getPXE();
        if (!pxe) throw new Error('PXE not initialized. Call connect() first.');

        if (typeof (pxe as any)[method] !== 'function') {
          throw new Error(`Unknown PXE method: ${method}`);
        }
        return (pxe as any)[method](...params);
      } catch (err) {
        console.error(`[RPCHandler] Error in ${method}:`, err);
        throw err;
      }
    });
  }

  private async handleInitWithKeys(authKeys: PopupResponse): Promise<{ address: string }> {
    if (authKeys.type !== 'auth-keys') {
      throw new Error(`Expected auth-keys, got: ${authKeys.type}`);
    }

    // Decode base64-encoded binary fields
    const credentialIdBytes = fromBase64(authKeys.credentialId);
    const publicKeyBytes = fromBase64(authKeys.publicKey);
    const signingKeyBytes = fromBase64(authKeys.signingKey);
    const encryptionKeyBytes = fromBase64(authKeys.encryptionKey);

    // Store credential for future visits
    this.credentialStore.saveCredentialId(credentialIdBytes);
    this.credentialStore.savePublicKey(publicKeyBytes);

    // TIER-2-UPGRADE: Remove signingKey storage.
    this.signingKey = signingKeyBytes;

    // Import encryption key
    const encryptionKey = await crypto.subtle.importKey(
      'raw',
      encryptionKeyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );

    // Initialize PXE
    const node = await this.getAztecNode();
    const pxe = await this.pxeManager.initialize(node, encryptionKey);

    // Register account
    const masterSecret = BigInt(authKeys.masterSecret);
    const secretKey = new Fr(masterSecret);
    await pxe.registerAccount(secretKey, Fr.ZERO);

    // Register contracts
    for (const config of this.contractConfigs) {
      await pxe.registerContract({ instance: config, artifact: config.artifact });
    }

    // Get the registered address
    const accounts = await pxe.getRegisteredAccounts();
    const address = accounts[0]?.address?.toString() ?? 'unknown';
    return { address };
  }

  private async handleDisconnect(): Promise<void> {
    this.signingKey = null;
    await this.pxeManager.destroy();
  }

  private async getAztecNode(): Promise<any> {
    const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
    return createAztecNodeClient(this.nodeUrl);
  }
}
