import type { SecureChannel } from '../shared/SecureChannel';
import type { PopupResponse } from '../shared/types';
import type { PXEManager } from './PXEManager';
import type { CredentialStore } from './CredentialStore';
import { fromBase64 } from '../shared/encoding';

/**
 * Processes RPC messages from the SDK over the SecureChannel.
 *
 * - initWithKeys: receives passkey-derived keys, initializes PXE Worker, registers account
 * - disconnect: tears down PXE Worker
 * - disconnect: tears down PXE Worker
 * - All other methods: forwarded to the PXE Worker
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

        // All other methods are forwarded to the PXE Worker
        if (!this.pxeManager.isInitialized()) {
          throw new Error('PXE not initialized. Call connect() first.');
        }
        return this.pxeManager.callPXE(method, params);
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

    // Initialize PXE in Worker — send raw encryption key bytes
    // (CryptoKey is not transferable across postMessage)
    console.log('[RPCHandler] Initializing PXE Worker for', this.nodeUrl);
    const address = await this.pxeManager.initialize(
      this.nodeUrl,
      encryptionKeyBytes,
      authKeys.masterSecret,
      authKeys.accountSalt,
      this.contractConfigs,
    );
    console.log('[RPCHandler] PXE Worker initialized, address:', address);

    return { address };
  }

  private async handleDisconnect(): Promise<void> {
    this.signingKey = null;
    await this.pxeManager.destroy();
  }
}
