import type { SecureChannel } from '../shared/SecureChannel';
import type { TxSummary } from '../shared/types';
import type { PXEManager } from './PXEManager';
import type { PopupOrchestrator } from './PopupOrchestrator';
import type { CredentialStore } from './CredentialStore';
import { Fr } from '@aztec/foundation/curves/bn254';

const TX_METHODS = new Set(['proveTx', 'sendTx']);
// TIER-2-UPGRADE: TX_METHODS trigger WebAuthn signing ceremony in popup, not just consent.

export class RPCHandler {
  // TIER-2-UPGRADE: Remove signingKey field.
  private signingKey: Uint8Array | null = null;

  constructor(
    private pxeManager: PXEManager,
    private popupOrchestrator: PopupOrchestrator,
    private credentialStore: CredentialStore,
    private contractConfigs: any[],
  ) {}

  register(channel: SecureChannel): void {
    channel.onRequest(async (method, params) => {
      if (method === 'connect') return this.handleConnect();
      if (method === 'disconnect') return this.handleDisconnect();

      const pxe = this.pxeManager.getPXE();
      if (!pxe) throw new Error('PXE not initialized. Call connect() first.');

      if (TX_METHODS.has(method)) await this.requireTxApproval(params);

      if (typeof (pxe as any)[method] !== 'function') {
        throw new Error(`Unknown PXE method: ${method}`);
      }
      return (pxe as any)[method](...params);
    });
  }

  private async handleConnect(): Promise<{ address: string }> {
    const credentialId = this.credentialStore.getCredentialId();
    const response = await this.popupOrchestrator.openPopup(
      'connect', undefined, credentialId ?? undefined,
    );
    if (response.type !== 'auth-keys') throw new Error(`Unexpected response: ${response.type}`);

    this.credentialStore.saveCredentialId(new Uint8Array(response.credentialId));
    this.credentialStore.savePublicKey(new Uint8Array(response.publicKey));
    // TIER-2-UPGRADE: Remove signingKey storage.
    this.signingKey = new Uint8Array(response.signingKey);

    const encryptionKey = await crypto.subtle.importKey(
      'raw', new Uint8Array(response.encryptionKey),
      { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
    );

    const node = await this.getAztecNode();
    const pxe = await this.pxeManager.initialize(node, encryptionKey);

    const masterSecret = BigInt(response.masterSecret);
    const secretKey = new Fr(masterSecret);
    await pxe.registerAccount(secretKey, Fr.ZERO);

    for (const config of this.contractConfigs) {
      await pxe.registerContract({ instance: config, artifact: config.artifact });
    }

    const accounts = await pxe.getRegisteredAccounts();
    const address = accounts[0]?.address?.toString() ?? 'unknown';
    return { address };
  }

  private async handleDisconnect(): Promise<void> {
    this.signingKey = null;
    await this.pxeManager.destroy();
  }

  private async requireTxApproval(params: unknown[]): Promise<void> {
    const summary: TxSummary = {
      contractAddress: 'unknown',
      methodName: 'unknown',
      args: params,
      dappOrigin: '*',
    };
    const response = await this.popupOrchestrator.openPopup('sign', summary);
    if (response.type === 'tx-cancelled') throw new Error('Transaction rejected by user');
    if (response.type !== 'tx-approved') throw new Error(`Unexpected: ${response.type}`);
    // TIER-2-UPGRADE: response will have auth-witness from WebAuthn signing
  }

  private async getAztecNode(): Promise<any> {
    const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
    return createAztecNodeClient('https://devnet.aztec-labs.com/');
  }
}
