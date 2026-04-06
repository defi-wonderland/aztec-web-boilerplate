import { describe, it, expect, beforeEach } from 'vitest';
import { SecureChannel } from '../SecureChannel';

describe('SecureChannel', () => {
  let parentChannel: SecureChannel;
  let iframeChannel: SecureChannel;

  beforeEach(async () => {
    const { port1, port2 } = new MessageChannel();
    parentChannel = new SecureChannel('p2i');
    iframeChannel = new SecureChannel('i2p');
    await SecureChannel.handshake(parentChannel, port1, iframeChannel, port2);
  });

  it('establishes encrypted channel via ECDH handshake', () => {
    expect(parentChannel.isReady()).toBe(true);
    expect(iframeChannel.isReady()).toBe(true);
  });

  it('sends and receives encrypted messages', async () => {
    iframeChannel.onRequest(async (method, params) => {
      expect(method).toBe('test');
      expect(params).toEqual([1, 'hello']);
      return { result: 'ok' };
    });

    const result = await parentChannel.send('test', [1, 'hello']);
    expect(result).toEqual({ result: 'ok' });
  });

  it('handles multiple concurrent requests', async () => {
    iframeChannel.onRequest(async (method, params) => {
      return { echo: params[0] };
    });

    const [r1, r2, r3] = await Promise.all([
      parentChannel.send('a', [1]),
      parentChannel.send('b', [2]),
      parentChannel.send('c', [3]),
    ]);

    expect(r1).toEqual({ echo: 1 });
    expect(r2).toEqual({ echo: 2 });
    expect(r3).toEqual({ echo: 3 });
  });

  it('rejects when remote handler throws', async () => {
    iframeChannel.onRequest(async () => {
      throw new Error('handler error');
    });

    await expect(parentChannel.send('fail', [])).rejects.toThrow('handler error');
  });
});
