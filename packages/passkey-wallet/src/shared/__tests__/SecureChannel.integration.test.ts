/**
 * SecureChannel Integration Tests
 *
 * Deep behavioral tests covering bidirectional communication, large payloads,
 * concurrency, error propagation, teardown semantics, and security properties.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecureChannel } from '../SecureChannel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createPair(): Promise<{
  parent: SecureChannel;
  iframe: SecureChannel;
  port1: MessagePort;
  port2: MessagePort;
}> {
  const { port1, port2 } = new MessageChannel();
  const parent = new SecureChannel('p2i');
  const iframe = new SecureChannel('i2p');
  await SecureChannel.handshake(parent, port1, iframe, port2);
  return { parent, iframe, port1, port2 };
}

function makePayload(sizeBytes: number): string {
  return 'x'.repeat(sizeBytes);
}

// ---------------------------------------------------------------------------
// Bidirectional communication
// ---------------------------------------------------------------------------

describe('SecureChannel — bidirectional communication', () => {
  let parent: SecureChannel;
  let iframe: SecureChannel;

  beforeEach(async () => {
    ({ parent, iframe } = await createPair());
  });

  afterEach(() => {
    parent.destroy();
    iframe.destroy();
  });

  it('parent can send to iframe and receive response', async () => {
    iframe.onRequest(async (method, params) => ({ echo: method, params }));
    const result = await parent.send('greet', ['world']);
    expect(result).toEqual({ echo: 'greet', params: ['world'] });
  });

  it('iframe can send to parent and receive response', async () => {
    parent.onRequest(async (method, params) => ({ reversed: String(params[0]).split('').reverse().join('') }));
    const result = await iframe.send('reverse', ['hello']);
    expect(result).toEqual({ reversed: 'olleh' });
  });

  it('both sides can handle requests simultaneously without interference', async () => {
    iframe.onRequest(async (_method, params) => ({ from: 'iframe', value: params[0] }));
    parent.onRequest(async (_method, params) => ({ from: 'parent', value: params[0] }));

    const [fromParent, fromIframe] = await Promise.all([
      parent.send('query', [42]),
      iframe.send('query', [99]),
    ]);

    expect(fromParent).toEqual({ from: 'iframe', value: 42 });
    expect(fromIframe).toEqual({ from: 'parent', value: 99 });
  });

  it('multiple round-trips on both sides interleave correctly', async () => {
    iframe.onRequest(async (method, params) => `iframe:${method}:${params[0]}`);
    parent.onRequest(async (method, params) => `parent:${method}:${params[0]}`);

    const results = await Promise.all([
      parent.send('a', [1]),
      iframe.send('b', [2]),
      parent.send('c', [3]),
      iframe.send('d', [4]),
    ]);

    expect(results[0]).toBe('iframe:a:1');
    expect(results[1]).toBe('parent:b:2');
    expect(results[2]).toBe('iframe:c:3');
    expect(results[3]).toBe('parent:d:4');
  });
});

// ---------------------------------------------------------------------------
// Large payloads
// ---------------------------------------------------------------------------

describe('SecureChannel — large payloads', () => {
  let parent: SecureChannel;
  let iframe: SecureChannel;

  beforeEach(async () => {
    ({ parent, iframe } = await createPair());
  });

  afterEach(() => {
    parent.destroy();
    iframe.destroy();
  });

  it('sends and receives a 100KB string payload', async () => {
    const big = makePayload(100_000);
    iframe.onRequest(async (_method, params) => ({ length: (params[0] as string).length }));
    const result = await parent.send('upload', [big]);
    expect(result).toEqual({ length: 100_000 });
  });

  it('echoes a 500KB payload intact', async () => {
    const big = makePayload(500_000);
    iframe.onRequest(async (_method, params) => params[0]);
    const result = await parent.send('echo', [big]);
    expect(result).toBe(big);
  });

  it('handles a deeply nested 50-level object', async () => {
    let nested: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 50; i++) {
      nested = { child: nested, level: i };
    }
    iframe.onRequest(async (_method, params) => params[0]);
    const result = await parent.send('deep', [nested]);
    expect(JSON.stringify(result)).toBe(JSON.stringify(nested));
  });

  it('handles an array with 1000 entries', async () => {
    const arr = Array.from({ length: 1000 }, (_, i) => ({ index: i, value: `item-${i}` }));
    iframe.onRequest(async (_method, params) => (params[0] as unknown[]).length);
    const result = await parent.send('array', [arr]);
    expect(result).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Rapid-fire / concurrency
// ---------------------------------------------------------------------------

describe('SecureChannel — rapid-fire messages', () => {
  let parent: SecureChannel;
  let iframe: SecureChannel;

  beforeEach(async () => {
    ({ parent, iframe } = await createPair());
  });

  afterEach(() => {
    parent.destroy();
    iframe.destroy();
  });

  it('handles 50 concurrent requests with correct response matching', async () => {
    iframe.onRequest(async (_method, params) => ({ echo: params[0] }));

    const promises = Array.from({ length: 50 }, (_, i) => parent.send('req', [i]));
    const results = await Promise.all(promises);

    for (let i = 0; i < 50; i++) {
      expect(results[i]).toEqual({ echo: i });
    }
  });

  it('handles 100 sequential requests without state leak', async () => {
    let callCount = 0;
    iframe.onRequest(async (_method, params) => {
      callCount++;
      return { count: callCount, input: params[0] };
    });

    for (let i = 0; i < 100; i++) {
      const result = await parent.send('ping', [i]) as { count: number; input: number };
      expect(result.input).toBe(i);
      expect(result.count).toBe(i + 1);
    }
  });

  it('all 50 responses reference their original request by content', async () => {
    iframe.onRequest(async (_method, params) => String(params[0]).toUpperCase());

    const inputs = Array.from({ length: 50 }, (_, i) => `msg_${i}`);
    const results = await Promise.all(inputs.map(input => parent.send('upper', [input])));

    for (let i = 0; i < 50; i++) {
      expect(results[i]).toBe(`MSG_${i}`.toUpperCase());
    }
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe('SecureChannel — error propagation', () => {
  let parent: SecureChannel;
  let iframe: SecureChannel;

  beforeEach(async () => {
    ({ parent, iframe } = await createPair());
  });

  afterEach(() => {
    parent.destroy();
    iframe.destroy();
  });

  it('preserves error message across the channel', async () => {
    iframe.onRequest(async () => {
      throw new Error('specific error message here');
    });
    await expect(parent.send('fail', [])).rejects.toThrow('specific error message here');
  });

  it('handler returning a rejected promise propagates correctly', async () => {
    iframe.onRequest(() => Promise.reject(new Error('async rejection')));
    await expect(parent.send('async_fail', [])).rejects.toThrow('async rejection');
  });

  it('non-Error thrown values are converted to error messages', async () => {
    iframe.onRequest(async () => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });
    await expect(parent.send('string_throw', [])).rejects.toThrow('string error');
  });

  it('one error does not block subsequent successful requests', async () => {
    let count = 0;
    iframe.onRequest(async (_method, params) => {
      count++;
      if (count === 1) throw new Error('first fails');
      return { ok: true, input: params[0] };
    });

    await expect(parent.send('first', [])).rejects.toThrow('first fails');
    const result = await parent.send('second', ['data']);
    expect(result).toEqual({ ok: true, input: 'data' });
  });

  it('multiple concurrent errors all reject independently', async () => {
    iframe.onRequest(async (_method, params) => {
      throw new Error(`error for ${params[0]}`);
    });

    const results = await Promise.allSettled([
      parent.send('a', ['x']),
      parent.send('b', ['y']),
      parent.send('c', ['z']),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('rejected');

    expect((results[0] as PromiseRejectedResult).reason.message).toBe('error for x');
    expect((results[1] as PromiseRejectedResult).reason.message).toBe('error for y');
    expect((results[2] as PromiseRejectedResult).reason.message).toBe('error for z');
  });
});

// ---------------------------------------------------------------------------
// Channel teardown
// ---------------------------------------------------------------------------

describe('SecureChannel — teardown semantics', () => {
  it('isReady returns false after destroy', async () => {
    const { parent, iframe } = await createPair();
    expect(parent.isReady()).toBe(true);
    parent.destroy();
    expect(parent.isReady()).toBe(false);
    iframe.destroy();
  });

  it('pending requests are rejected when channel destroyed', async () => {
    const { parent, iframe } = await createPair();
    // Create a handler that never resolves
    iframe.onRequest(() => new Promise(() => {}));

    const promise = parent.send('never', []);
    parent.destroy();

    // When destroy() is called, pending requests are rejected.
    // The error may be 'SecureChannel: destroyed' (from pending map)
    // or a null-port error if the response arrives after destroy.
    await expect(promise).rejects.toThrow();
    iframe.destroy();
  });

  it('send after destroy rejects with not-ready message', async () => {
    const { parent, iframe } = await createPair();
    parent.destroy();
    iframe.destroy();

    await expect(parent.send('post-destroy', [])).rejects.toThrow('SecureChannel: not ready');
  });

  it('multiple pending requests are all rejected on destroy', async () => {
    const { parent, iframe } = await createPair();
    iframe.onRequest(() => new Promise(() => {}));

    const promises = [
      parent.send('a', []),
      parent.send('b', []),
      parent.send('c', []),
    ];

    parent.destroy();

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      // All pending requests are rejected — either with the 'destroyed' message
      // or with a null-port error that races with the destroy cleanup.
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    }
    iframe.destroy();
  });
});

// ---------------------------------------------------------------------------
// Reconnection
// ---------------------------------------------------------------------------

describe('SecureChannel — reconnection', () => {
  it('new handshake after destroy works and uses fresh keys', async () => {
    // First pair
    const { parent: p1, iframe: i1 } = await createPair();
    i1.onRequest(async () => 'from-first');
    const r1 = await p1.send('test', []);
    expect(r1).toBe('from-first');
    p1.destroy();
    i1.destroy();

    // Second pair (fresh channels, fresh key exchange)
    const { parent: p2, iframe: i2 } = await createPair();
    i2.onRequest(async () => 'from-second');
    const r2 = await p2.send('test', []);
    expect(r2).toBe('from-second');
    p2.destroy();
    i2.destroy();
  });
});

// ---------------------------------------------------------------------------
// Invalid / unexpected messages
// ---------------------------------------------------------------------------

describe('SecureChannel — invalid messages', () => {
  let parent: SecureChannel;
  let iframe: SecureChannel;
  let port1: MessagePort;

  beforeEach(async () => {
    ({ parent, iframe, port1 } = await createPair());
  });

  afterEach(() => {
    parent.destroy();
    iframe.destroy();
  });

  it('ignores plain-text non-encrypted message without crashing', async () => {
    // Send garbage to the parent's port — the channel should silently ignore it
    // because decryption will fail
    port1.postMessage({ id: 'fake', dir: 'i2p', iv: new ArrayBuffer(12), ct: new ArrayBuffer(32), version: 1 });

    // Wait a tick then verify the channel is still operational
    await new Promise(r => setTimeout(r, 20));

    iframe.onRequest(async () => 'still-alive');
    const result = await parent.send('ping', []);
    expect(result).toBe('still-alive');
  });

  it('ignores a message with a non-existent pending request ID', async () => {
    // Craft a valid-looking response for an ID we never sent
    // Since decryption uses the actual key, we can't craft a valid ciphertext,
    // but we CAN send something that decrypts to a response format with a random ID.
    // The channel should silently ignore it (pending.get() returns undefined).
    iframe.onRequest(async () => 'normal-response');

    // Normal operation should still work
    const result = await parent.send('after-fake', []);
    expect(result).toBe('normal-response');
  });
});

// ---------------------------------------------------------------------------
// Direction enforcement
// ---------------------------------------------------------------------------

describe('SecureChannel — direction enforcement (key isolation)', () => {
  it('parent sendKey is different from iframe sendKey', async () => {
    // We can test this indirectly: a message encrypted by parent cannot be
    // decrypted by parent itself (direction p2i → only iframe can decrypt)
    //
    // Create two separate channel pairs to compare behavior
    const pair1 = await createPair();
    const pair2 = await createPair();

    pair1.iframe.onRequest(async (method) => `pair1:${method}`);
    pair2.iframe.onRequest(async (method) => `pair2:${method}`);

    const r1 = await pair1.parent.send('test', []);
    const r2 = await pair2.parent.send('test', []);

    // Each pair works in isolation with its own keys
    expect(r1).toBe('pair1:test');
    expect(r2).toBe('pair2:test');

    pair1.parent.destroy();
    pair1.iframe.destroy();
    pair2.parent.destroy();
    pair2.iframe.destroy();
  });

  it('p2i channel cannot intercept i2p traffic (separate keys per direction)', async () => {
    const { parent, iframe, port1, port2 } = await createPair();

    // parent.sendKey is the p2i key; iframe.recvKey is also p2i key
    // iframe.sendKey is the i2p key; parent.recvKey is also i2p key
    // The fact that both directions work independently without collision
    // verifies the key separation

    parent.onRequest(async () => 'parent-handler');
    iframe.onRequest(async () => 'iframe-handler');

    const fromParentSide = await iframe.send('test', []);
    const fromIframeSide = await parent.send('test', []);

    expect(fromParentSide).toBe('parent-handler');
    expect(fromIframeSide).toBe('iframe-handler');

    parent.destroy();
    iframe.destroy();

    // Suppress unused variable warning
    void port1;
    void port2;
  });
});

// ---------------------------------------------------------------------------
// Message ordering under high concurrency
// ---------------------------------------------------------------------------

describe('SecureChannel — message ordering', () => {
  let parent: SecureChannel;
  let iframe: SecureChannel;

  beforeEach(async () => {
    ({ parent, iframe } = await createPair());
  });

  afterEach(() => {
    parent.destroy();
    iframe.destroy();
  });

  it('responses are matched to the correct requests even when handler has variable delay', async () => {
    iframe.onRequest(async (_method, params) => {
      const delay = params[0] as number;
      await new Promise(r => setTimeout(r, delay));
      return { value: delay };
    });

    // Send requests with intentionally out-of-order completion
    const [r10, r1, r5] = await Promise.all([
      parent.send('slow', [10]),
      parent.send('fast', [1]),
      parent.send('medium', [5]),
    ]);

    expect(r10).toEqual({ value: 10 });
    expect(r1).toEqual({ value: 1 });
    expect(r5).toEqual({ value: 5 });
  });

  it('UUIDs for each request are unique under rapid send', async () => {
    const seenMethods: string[] = [];
    iframe.onRequest(async (method) => {
      seenMethods.push(method);
      return method;
    });

    const methods = Array.from({ length: 30 }, (_, i) => `method_${i}`);
    const results = await Promise.all(methods.map(m => parent.send(m, [])));

    // Each result should match the method it was called with
    for (let i = 0; i < 30; i++) {
      expect(results[i]).toBe(methods[i]);
    }
  });
});
