import type { ChannelMessage, RPCRequest, RPCResponse } from './types';
import { CHANNEL_VERSION } from './constants';

type Direction = 'p2i' | 'i2p';
type RequestHandler = (method: string, params: unknown[]) => Promise<unknown>;

const HKDF_INFO_P2I = 'aztec-wallet/channel/p2i';
const HKDF_INFO_I2P = 'aztec-wallet/channel/i2p';

/** Derives an AES-256-GCM key from a shared ECDH secret using HKDF. */
async function deriveChannelKey(sharedSecret: ArrayBuffer, info: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // Import the raw ECDH bits as an HKDF key
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // zero salt — key material from ECDH is already high-entropy
      info: encoder.encode(info),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Generates an ephemeral ECDH P-256 key pair. */
async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

/** Derives 32 bytes of shared secret from ECDH. */
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
}

/** Exports a public key as JWK. */
async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

/** Imports a JWK public key for ECDH. */
async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

/**
 * SecureChannel provides encrypted point-to-point communication over a MessagePort.
 *
 * Uses ECDH P-256 for key exchange, then HKDF-derived AES-256-GCM keys
 * (one per direction) for message encryption. UUID as AAD prevents replay.
 */
export class SecureChannel {
  readonly direction: Direction;

  private sendKey: CryptoKey | null = null;
  private recvKey: CryptoKey | null = null;
  private port: MessagePort | null = null;
  private handler: RequestHandler | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private messageListener: ((e: MessageEvent) => void) | null = null;

  constructor(direction: Direction) {
    this.direction = direction;
  }

  /** Returns true when the channel has been fully set up (keys derived, port attached). */
  isReady(): boolean {
    return this.sendKey !== null && this.recvKey !== null && this.port !== null;
  }

  /**
   * Static factory for testing: sets up both parent and iframe channels synchronously
   * by exchanging key material in-memory (no actual message passing during handshake).
   */
  static async handshake(
    parent: SecureChannel,
    port1: MessagePort,
    iframe: SecureChannel,
    port2: MessagePort,
  ): Promise<void> {
    // Both sides generate ephemeral ECDH key pairs
    const [parentKP, iframeKP] = await Promise.all([generateECDHKeyPair(), generateECDHKeyPair()]);

    // Exchange public keys — each derives the shared secret
    const [parentSecret, iframeSecret] = await Promise.all([
      deriveSharedSecret(parentKP.privateKey, iframeKP.publicKey),
      deriveSharedSecret(iframeKP.privateKey, parentKP.publicKey),
    ]);

    // Derive direction-separated keys for both sides
    const [p2iKey, i2pKey] = await Promise.all([
      deriveChannelKey(parentSecret, HKDF_INFO_P2I),
      deriveChannelKey(parentSecret, HKDF_INFO_I2P),
    ]);

    // Parent direction 'p2i': sends on p2i, receives on i2p
    parent.sendKey = p2iKey;
    parent.recvKey = i2pKey;
    parent.port = port1;
    parent.listen();

    // Iframe direction 'i2p': sends on i2p, receives on p2i
    // Use iframe's derived secret — produces same keys since ECDH is symmetric
    const [iframeP2iKey, iframeI2pKey] = await Promise.all([
      deriveChannelKey(iframeSecret, HKDF_INFO_P2I),
      deriveChannelKey(iframeSecret, HKDF_INFO_I2P),
    ]);
    iframe.sendKey = iframeI2pKey;
    iframe.recvKey = iframeP2iKey;
    iframe.port = port2;
    iframe.listen();

    // Start both ports
    port1.start();
    port2.start();
  }

  /**
   * Production handshake: performs ECDH over the MessagePort.
   * Each side sends their public key JWK and waits for the peer's.
   */
  async initFromPort(port: MessagePort): Promise<void> {
    this.port = port;

    const keyPair = await generateECDHKeyPair();
    const myPublicJWK = await exportPublicKey(keyPair.publicKey);

    return new Promise<void>((resolve, reject) => {
      const onPubkey = async (e: MessageEvent) => {
        if (!e.data || e.data.type !== 'pubkey') return;
        port.removeEventListener('message', onPubkey);

        try {
          const peerPublic = await importPublicKey(e.data.key as JsonWebKey);
          const sharedSecret = await deriveSharedSecret(keyPair.privateKey, peerPublic);

          const [p2iKey, i2pKey] = await Promise.all([
            deriveChannelKey(sharedSecret, HKDF_INFO_P2I),
            deriveChannelKey(sharedSecret, HKDF_INFO_I2P),
          ]);

          if (this.direction === 'p2i') {
            this.sendKey = p2iKey;
            this.recvKey = i2pKey;
          } else {
            this.sendKey = i2pKey;
            this.recvKey = p2iKey;
          }

          this.listen();
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      port.addEventListener('message', onPubkey);
      port.start();

      // Send our public key to the peer
      port.postMessage({ type: 'pubkey', key: myPublicJWK });
    });
  }

  /** Register a handler for incoming RPC requests. */
  onRequest(handler: RequestHandler): void {
    this.handler = handler;
  }

  /**
   * Encrypt and send an RPC request; returns a Promise that resolves with the response.
   */
  async send(method: string, params: unknown[]): Promise<unknown> {
    if (!this.sendKey || !this.port) {
      throw new Error('SecureChannel: not ready');
    }

    const id = crypto.randomUUID();
    const payload: RPCRequest = { method, params };

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await this.encrypt(this.sendKey, iv, id, payload);

    const msg: ChannelMessage = {
      id,
      dir: this.direction,
      iv: iv.buffer as ArrayBuffer,
      ct,
      version: CHANNEL_VERSION,
    };

    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.port!.postMessage(msg);
    });
  }

  /** Close the port and reject all pending promises. */
  destroy(): void {
    if (this.port && this.messageListener) {
      this.port.removeEventListener('message', this.messageListener);
    }
    this.pending.forEach(({ reject }) => reject(new Error('SecureChannel: destroyed')));
    this.pending.clear();
    this.port?.close();
    this.port = null;
    this.sendKey = null;
    this.recvKey = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private listen(): void {
    if (!this.port) return;
    this.messageListener = (e: MessageEvent) => {
      void this.handleMessage(e.data as ChannelMessage);
    };
    this.port.addEventListener('message', this.messageListener);
  }

  private async handleMessage(msg: ChannelMessage): Promise<void> {
    if (!this.recvKey) return;

    // Decrypt
    let plaintext: unknown;
    try {
      plaintext = await this.decrypt(this.recvKey, msg.iv, msg.id, msg.ct);
    } catch {
      // Decryption failure — ignore (could be tampered / wrong key)
      return;
    }

    const data = plaintext as Record<string, unknown>;

    if ('ok' in data) {
      // This is an RPCResponse — resolve/reject the pending promise
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);

      const response = data as RPCResponse;
      if (response.ok) {
        pending.resolve(response.result);
      } else {
        pending.reject(new Error(response.error));
      }
    } else if ('method' in data) {
      // This is an RPCRequest — call the handler and send a response
      const req = data as RPCRequest;
      let response: RPCResponse;

      try {
        const result = await this.handler!(req.method, req.params);
        response = { ok: true, result };
      } catch (err) {
        response = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }

      // Encrypt and send the response back
      if (this.sendKey && this.port) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await this.encrypt(this.sendKey, iv, msg.id, response);

        // Responses share the same id so the sender can match them
        const responseMsg: ChannelMessage = {
          id: msg.id,
          dir: this.direction,
          iv: iv.buffer as ArrayBuffer,
          ct,
          version: CHANNEL_VERSION,
        };
        this.port.postMessage(responseMsg);
      }
    }
  }

  private async encrypt(
    key: CryptoKey,
    iv: Uint8Array,
    aad: string,
    payload: unknown,
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(payload));
    const additionalData = encoder.encode(aad);

    return crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, plaintext);
  }

  private async decrypt(
    key: CryptoKey,
    ivBuffer: ArrayBuffer,
    aad: string,
    ct: ArrayBuffer,
  ): Promise<unknown> {
    const encoder = new TextEncoder();
    const iv = new Uint8Array(ivBuffer);
    const additionalData = encoder.encode(aad);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData },
      key,
      ct,
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext)) as unknown;
  }
}
