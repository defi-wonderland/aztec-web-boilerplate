import { describe, it, expect, beforeEach } from 'vitest';
import { PXEProxy } from '../PXEProxy';
import { SecureChannel } from '../../shared/SecureChannel';

describe('PXEProxy', () => {
  let parentChannel: SecureChannel;
  let iframeChannel: SecureChannel;
  let proxy: PXEProxy;

  beforeEach(async () => {
    const { port1, port2 } = new MessageChannel();
    parentChannel = new SecureChannel('p2i');
    iframeChannel = new SecureChannel('i2p');
    await SecureChannel.handshake(parentChannel, port1, iframeChannel, port2);
    proxy = new PXEProxy(parentChannel);
  });

  it('forwards method calls over the secure channel', async () => {
    iframeChannel.onRequest(async (method, params) => {
      if (method === 'getRegisteredAccounts') return ['0xabc'];
      throw new Error(`Unknown method: ${method}`);
    });
    const accounts = await proxy.call('getRegisteredAccounts', []);
    expect(accounts).toEqual(['0xabc']);
  });

  it('propagates errors from the remote PXE', async () => {
    iframeChannel.onRequest(async () => { throw new Error('PXE not initialized'); });
    await expect(proxy.call('simulateTx', [])).rejects.toThrow('PXE not initialized');
  });

  it('createInterface creates a transparent proxy', async () => {
    iframeChannel.onRequest(async (method) => `called:${method}`);
    const iface = proxy.createInterface<{ someMethod: () => Promise<string> }>();
    const result = await iface.someMethod();
    expect(result).toBe('called:someMethod');
  });
});
