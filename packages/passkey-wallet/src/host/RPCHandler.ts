import type { SecureChannel } from '../shared/SecureChannel';
import type { PopupResponse } from '../shared/types';
import type { PXEManager } from './PXEManager';
import type { CredentialStore } from './CredentialStore';
import { fromBase64 } from '../shared/encoding';
import { CapabilityGuard, type GuardPayload } from './capabilities/CapabilityGuard';

/** Methods that are write operations (need biometric regardless of scope). */
const WRITE_METHODS = new Set(['sendTx', 'createAuthWit']);

/**
 * Processes RPC messages from the SDK over the SecureChannel.
 *
 * - initWithKeys: receives passkey-derived keys + capability manifest, initializes PXE Worker
 * - disconnect: tears down PXE Worker, clears grants
 * - wallet methods: checked against CapabilityGuard before forwarding to Worker
 * - All other methods: forwarded to the PXE Worker
 */
export class RPCHandler {
  // TIER-2-UPGRADE: Remove signingKey field.
  private signingKey: Uint8Array | null = null;
  private guard: CapabilityGuard = new CapabilityGuard();
  private channel: SecureChannel | null = null;

  constructor(
    private pxeManager: PXEManager,
    private credentialStore: CredentialStore,
    private contractConfigs: any[],
    private nodeUrl: string,
  ) {}

  register(channel: SecureChannel): void {
    this.channel = channel;

    channel.onRequest(async (method, params) => {
      try {
        if (method === 'initWithKeys') return await this.handleInitWithKeys(params[0] as PopupResponse, params[1]);
        if (method === 'disconnect') return await this.handleDisconnect();

        // Wallet method calls: params = [walletMethodName, serializedArgs]
        if (method === 'wallet') {
          if (!this.pxeManager.isInitialized()) {
            throw new Error('Wallet not initialized. Call connect() first.');
          }
          const walletMethod = params[0] as string;
          const serializedArgs = params[1] as string;

          // Capability guard check
          const payload = this.extractPayload(walletMethod, serializedArgs);
          const decision = this.guard.check(walletMethod, payload);
          if (decision === 'prompt') {
            console.log(`[RPCHandler] wallet.${walletMethod} — prompting (outside scope)`);
            const approved = await this.requestRuntimePrompt(walletMethod, payload);
            if (!approved) throw new Error('User denied: operation not authorized');
          }


          return this.pxeManager.callWallet(walletMethod, serializedArgs);
        }

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

  /**
   * Extract contract address and function name from serialized wallet call args.
   * Best-effort parsing — returns partial payload if extraction fails.
   * The guard falls back to 'prompt' for missing fields (safe default).
   */
  private extractPayload(method: string, serializedArgs: string): GuardPayload {
    try {
      const parsed = JSON.parse(serializedArgs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        // ExecutionPayload shape: { calls: [{ to, name, ... }], feePayer? }
        // When a fee payment method is used, the SDK puts the fee call at
        // calls[0] and the user call(s) after it. The feePayer field matches
        // the fee call's target address. Skip it to extract the real user intent.
        if (first?.calls && Array.isArray(first.calls) && first.calls.length > 0) {
          const feePayer = first.feePayer?.toString?.() ?? first.feePayer;
          const userCall = first.calls.find((c: any) => {
            const to = c.to?.toString?.() ?? c.to;
            return !feePayer || to !== feePayer;
          }) ?? first.calls[0]; // fallback to first if all match (unlikely)
          return {
            contractAddress: userCall.to?.toString?.() ?? userCall.to,
            functionName: userCall.name ?? userCall.functionName,
          };
        }
        // registerContract: first arg is the contract instance with address
        if (first?.address) {
          return { contractAddress: first.address.toString?.() ?? first.address };
        }
        // Simple address arg (getContractMetadata, getPrivateEvents)
        if (typeof first === 'string' && first.startsWith('0x')) {
          return { contractAddress: first };
        }
      }
    } catch {
      // JSON parse failed — return empty payload, guard will default to 'prompt'
    }
    return {};
  }

  /**
   * Send a runtime prompt request to the SDK via the bidirectional SecureChannel.
   * The SDK opens a popup for the user to approve/deny.
   */
  private async requestRuntimePrompt(method: string, payload: GuardPayload): Promise<boolean> {
    if (!this.channel) return false;
    try {
      const isWrite = WRITE_METHODS.has(method);
      const result = await this.channel.send('runtime-prompt', [{
        methodName: method,
        contractAddress: payload.contractAddress,
        functionName: payload.functionName,
        dappOrigin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
        operationType: isWrite ? 'write' : 'read',
      }]);
      return result === true;
    } catch {
      return false;
    }
  }

  private async handleInitWithKeys(authKeys: PopupResponse, manifest?: unknown): Promise<{ address: string }> {
    if (authKeys.type !== 'auth-keys') {
      throw new Error(`Expected auth-keys, got: ${authKeys.type}`);
    }

    // Store capability grants from manifest
    if (manifest && typeof manifest === 'object' && 'capabilities' in manifest) {
      this.guard = new CapabilityGuard((manifest as { capabilities: unknown[] }).capabilities);
      console.log('[RPCHandler] Capability grants stored from manifest');
    } else {
      this.guard = new CapabilityGuard(); // No grants — everything prompts
      console.log('[RPCHandler] No manifest provided — all operations will prompt');
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
    console.log('[RPCHandler] Initializing PXE Worker for', this.nodeUrl);
    const address = await this.pxeManager.initialize(
      this.nodeUrl,
      encryptionKeyBytes,
      authKeys.masterSecret,
      authKeys.accountSalt,
      signingKeyBytes,
      this.contractConfigs,
    );
    console.log('[RPCHandler] PXE Worker initialized, address:', address);

    return { address };
  }

  private async handleDisconnect(): Promise<void> {
    this.signingKey = null;
    this.guard = new CapabilityGuard(); // Clear grants
    await this.pxeManager.destroy();
  }
}
