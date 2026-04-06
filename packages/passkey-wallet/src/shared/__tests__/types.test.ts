import { describe, it, expect } from 'vitest';
import type { ChannelMessage, RPCResponse, PopupResponse } from '../types';
import { CHANNEL_VERSION, RP_ID, EPHEMERAL_STORE_NAMES } from '../constants';

describe('shared types and constants', () => {
  it('ChannelMessage version matches constant', () => {
    const msg: ChannelMessage = {
      id: crypto.randomUUID(),
      dir: 'p2i',
      iv: new ArrayBuffer(12),
      ct: new ArrayBuffer(0),
      version: CHANNEL_VERSION,
    };
    expect(msg.version).toBe(1);
  });

  it('RPCResponse discriminates on ok field', () => {
    const success: RPCResponse = { ok: true, result: 42 };
    const failure: RPCResponse = { ok: false, error: 'bad' };
    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });

  it('PopupResponse discriminates on type field', () => {
    const authKeys: PopupResponse = {
      type: 'auth-keys',
      publicKey: new ArrayBuffer(65),
      credentialId: new ArrayBuffer(32),
      masterSecret: '0x1234',
      signingKey: new ArrayBuffer(32),
      encryptionKey: new ArrayBuffer(32),
      accountSalt: '0x5678',
    };
    expect(authKeys.type).toBe('auth-keys');
  });

  it('RP_ID is the broadest registrable domain', () => {
    expect(RP_ID).toBe('aztec.network');
  });

  it('ephemeral store names include key_store and complete_addresses', () => {
    expect(EPHEMERAL_STORE_NAMES.has('key_store')).toBe(true);
    expect(EPHEMERAL_STORE_NAMES.has('complete_addresses')).toBe(true);
    expect(EPHEMERAL_STORE_NAMES.has('complete_address_index')).toBe(true);
    expect(EPHEMERAL_STORE_NAMES.has('note_store')).toBe(false);
  });
});
