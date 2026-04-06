/**
 * PXEProxy + RPCHandler Integration Tests
 *
 * Simulates full SDK↔Host communication over encrypted SecureChannels without
 * requiring an actual PXE or browser APIs.
 *
 * Architecture under test:
 *   [SDK side]              [Host side]
 *   PXEProxy                channel handler (RPCHandler logic)
 *      └─ SecureChannel ←→ SecureChannel
 *                               └─ mock PXE
 *
 * RPCHandler is not imported directly because it contains a dynamic import of
 * @aztec/aztec.js which is not resolvable in the test environment.
 * Instead, we replicate its request-dispatch logic inline to test the
 * SecureChannel ↔ PXEProxy contract thoroughly.
 *
 * This tests:
 * - PXE method forwarding through encrypted channel
 * - Unknown method rejection
 * - Error propagation
 * - Transaction approval gate (TX_METHODS)
 * - Concurrent requests
 * - createInterface() proxy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecureChannel } from '../../shared/SecureChannel';
import { PXEProxy } from '../../sdk/PXEProxy';

// ---------------------------------------------------------------------------
// Inline RPCHandler-equivalent logic
// ---------------------------------------------------------------------------

const TX_METHODS = new Set(['proveTx', 'sendTx']);

type PopupResponse =
  | { type: 'auth-keys'; credentialId: ArrayBuffer; publicKey: ArrayBuffer; signingKey: ArrayBuffer; encryptionKey: ArrayBuffer; masterSecret: string }
  | { type: 'tx-approved' }
  | { type: 'tx-cancelled' }
  | { type: 'unknown' };

interface MockPXEInterface {
  [method: string]: (...args: unknown[]) => Promise<unknown>;
}

/**
 * Creates a handler function that mimics RPCHandler.register()'s request handler.
 * Returns a handler function to pass to channel.onRequest().
 */
function createRPCHandlerLogic(
  pxe: MockPXEInterface | null,
  popup: { openPopup: (type: string, summary?: unknown) => Promise<PopupResponse> }
): (method: string, params: unknown[]) => Promise<unknown> {
  return async (method: string, params: unknown[]) => {
    if (method === 'connect') return { address: '0xtest' };
    if (method === 'disconnect') return undefined;

    if (!pxe) throw new Error('PXE not initialized. Call connect() first.');

    if (TX_METHODS.has(method)) {
      const response = await popup.openPopup('sign', { args: params });
      if (response.type === 'tx-cancelled') throw new Error('Transaction rejected by user');
      if (response.type !== 'tx-approved') throw new Error(`Unexpected: ${response.type}`);
    }

    if (typeof pxe[method] !== 'function') {
      throw new Error(`Unknown PXE method: ${method}`);
    }
    return pxe[method](...params);
  };
}

// ---------------------------------------------------------------------------
// Mock types
// ---------------------------------------------------------------------------

class MockPXE implements MockPXEInterface {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private results = new Map<string, unknown>();
  private errors = new Map<string, string>();

  mockReturn(method: string, value: unknown): void {
    this.results.set(method, value);
    // Make the method callable
    (this as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
      this.calls.push({ method, args });
      return Promise.resolve(this.results.get(method));
    };
  }

  mockThrow(method: string, message: string): void {
    this.errors.set(method, message);
    (this as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
      this.calls.push({ method, args });
      return Promise.reject(new Error(message));
    };
  }

  [key: string]: unknown;
}

class MockPopupOrchestrator {
  approvedTypes: string[] = [];

  async openPopup(type: string): Promise<PopupResponse> {
    this.approvedTypes.push(type);
    if (type === 'sign') return { type: 'tx-approved' };
    return { type: 'unknown' };
  }
}

class RejectingPopupOrchestrator {
  async openPopup(type: string): Promise<PopupResponse> {
    if (type === 'sign') return { type: 'tx-cancelled' };
    return { type: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function createConnectedPair(
  pxe: MockPXEInterface | null,
  popup: { openPopup: (type: string, summary?: unknown) => Promise<PopupResponse> }
): Promise<{
  proxy: PXEProxy;
  parentChannel: SecureChannel;
  iframeChannel: SecureChannel;
}> {
  const { port1, port2 } = new MessageChannel();
  const parentChannel = new SecureChannel('p2i');
  const iframeChannel = new SecureChannel('i2p');
  await SecureChannel.handshake(parentChannel, port1, iframeChannel, port2);

  iframeChannel.onRequest(createRPCHandlerLogic(pxe, popup));

  const proxy = new PXEProxy(parentChannel);
  return { proxy, parentChannel, iframeChannel };
}

// ---------------------------------------------------------------------------
// Tests: PXE method passthrough
// ---------------------------------------------------------------------------

describe('PXEProxy + RPCHandler — PXE method passthrough', () => {
  let proxy: PXEProxy;
  let iframeChannel: SecureChannel;
  let parentChannel: SecureChannel;
  let mockPXE: MockPXE;
  let popup: MockPopupOrchestrator;

  beforeEach(async () => {
    mockPXE = new MockPXE();
    popup = new MockPopupOrchestrator();
    ({ proxy, iframeChannel, parentChannel } = await createConnectedPair(mockPXE, popup));
  });

  afterEach(() => {
    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('forwards getRegisteredAccounts to mock PXE and returns result', async () => {
    mockPXE.mockReturn('getRegisteredAccounts', [{ address: '0xabc' }]);
    const result = await proxy.call('getRegisteredAccounts', []);
    expect(result).toEqual([{ address: '0xabc' }]);
    expect(mockPXE.calls.some(c => c.method === 'getRegisteredAccounts')).toBe(true);
  });

  it('forwards getNodeInfo to mock PXE', async () => {
    mockPXE.mockReturn('getNodeInfo', { version: '1.0.0', chainId: 1 });
    const result = await proxy.call('getNodeInfo', []);
    expect(result).toEqual({ version: '1.0.0', chainId: 1 });
  });

  it('forwards method with parameters correctly', async () => {
    mockPXE.mockReturn('getContractInstance', { address: '0xdef', classId: '0x123' });
    await proxy.call('getContractInstance', ['0xdef']);
    const call = mockPXE.calls.find(c => c.method === 'getContractInstance');
    expect(call?.args).toEqual(['0xdef']);
  });

  it('unknown PXE method throws "Unknown PXE method" error', async () => {
    await expect(proxy.call('nonExistentMethod', [])).rejects.toThrow('Unknown PXE method: nonExistentMethod');
  });

  it('PXE method that throws propagates error message through the channel', async () => {
    mockPXE.mockThrow('getRegisteredAccounts', 'database corrupted');
    await expect(proxy.call('getRegisteredAccounts', [])).rejects.toThrow('database corrupted');
  });

  it('null PXE returns "PXE not initialized" error', async () => {
    const { port1, port2 } = new MessageChannel();
    const p = new SecureChannel('p2i');
    const i = new SecureChannel('i2p');
    await SecureChannel.handshake(p, port1, i, port2);

    i.onRequest(createRPCHandlerLogic(null, popup));
    const testProxy = new PXEProxy(p);

    await expect(testProxy.call('getRegisteredAccounts', [])).rejects.toThrow('PXE not initialized');

    p.destroy();
    i.destroy();
  });

  it('connect method succeeds without PXE (handled specially)', async () => {
    const { port1, port2 } = new MessageChannel();
    const p = new SecureChannel('p2i');
    const i = new SecureChannel('i2p');
    await SecureChannel.handshake(p, port1, i, port2);

    i.onRequest(createRPCHandlerLogic(null, popup));
    const testProxy = new PXEProxy(p);

    const result = await testProxy.call('connect', []);
    expect(result).toEqual({ address: '0xtest' });

    p.destroy();
    i.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: Multiple concurrent proxy calls
// ---------------------------------------------------------------------------

describe('PXEProxy + RPCHandler — concurrent calls', () => {
  let proxy: PXEProxy;
  let iframeChannel: SecureChannel;
  let parentChannel: SecureChannel;
  let mockPXE: MockPXE;

  beforeEach(async () => {
    mockPXE = new MockPXE();
    mockPXE.mockReturn('getChainId', 1);
    mockPXE.mockReturn('getEncodedEnr', 'enr:123');
    mockPXE.mockReturn('getBlockNumber', 42);
    ({ proxy, iframeChannel, parentChannel } = await createConnectedPair(mockPXE, new MockPopupOrchestrator()));
  });

  afterEach(() => {
    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('handles 10 concurrent proxy calls and returns correct results', async () => {
    const results = await Promise.all([
      proxy.call('getChainId', []),
      proxy.call('getEncodedEnr', []),
      proxy.call('getChainId', []),
      proxy.call('getBlockNumber', []),
      proxy.call('getChainId', []),
      proxy.call('getEncodedEnr', []),
      proxy.call('getChainId', []),
      proxy.call('getBlockNumber', []),
      proxy.call('getChainId', []),
      proxy.call('getEncodedEnr', []),
    ]);

    expect(results[0]).toBe(1);
    expect(results[1]).toBe('enr:123');
    expect(results[2]).toBe(1);
    expect(results[3]).toBe(42);
    expect(results[4]).toBe(1);
    expect(results[5]).toBe('enr:123');
    expect(results[6]).toBe(1);
    expect(results[7]).toBe(42);
    expect(results[8]).toBe(1);
    expect(results[9]).toBe('enr:123');
  });

  it('concurrent errors resolve independently', async () => {
    mockPXE.mockThrow('failingMethod', 'this one fails');
    mockPXE.mockReturn('workingMethod', 'success');

    const results = await Promise.allSettled([
      proxy.call('failingMethod', []),
      proxy.call('workingMethod', []),
      proxy.call('failingMethod', []),
      proxy.call('workingMethod', []),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(results[2].status).toBe('rejected');
    expect(results[3].status).toBe('fulfilled');

    expect((results[1] as PromiseFulfilledResult<unknown>).value).toBe('success');
    expect((results[3] as PromiseFulfilledResult<unknown>).value).toBe('success');
  });

  it('30 sequential calls all return correct results', async () => {
    mockPXE.mockReturn('ping', 'pong');
    for (let i = 0; i < 30; i++) {
      const result = await proxy.call('ping', []);
      expect(result).toBe('pong');
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: createInterface proxy
// ---------------------------------------------------------------------------

describe('PXEProxy + RPCHandler — createInterface', () => {
  let proxy: PXEProxy;
  let iframeChannel: SecureChannel;
  let parentChannel: SecureChannel;
  let mockPXE: MockPXE;

  beforeEach(async () => {
    mockPXE = new MockPXE();
    ({ proxy, iframeChannel, parentChannel } = await createConnectedPair(mockPXE, new MockPopupOrchestrator()));
  });

  afterEach(() => {
    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('createInterface forwards method calls transparently', async () => {
    mockPXE.mockReturn('getRegisteredAccounts', ['0xtest']);
    const pxe = proxy.createInterface<{ getRegisteredAccounts: () => Promise<string[]> }>();
    const result = await pxe.getRegisteredAccounts();
    expect(result).toEqual(['0xtest']);
  });

  it('createInterface does not intercept then/catch/finally (Promise duck-typing)', () => {
    const pxe = proxy.createInterface<Record<string, unknown>>();
    expect((pxe as Record<string, unknown>).then).toBeUndefined();
    expect((pxe as Record<string, unknown>).catch).toBeUndefined();
    expect((pxe as Record<string, unknown>).finally).toBeUndefined();
  });

  it('createInterface handles multiple sequential calls', async () => {
    mockPXE.mockReturn('getChainId', 31337);
    const pxe = proxy.createInterface<{ getChainId: () => Promise<number> }>();

    for (let i = 0; i < 5; i++) {
      const result = await pxe.getChainId();
      expect(result).toBe(31337);
    }
  });

  it('createInterface propagates errors from handler', async () => {
    mockPXE.mockThrow('badMethod', 'interface error');
    const pxe = proxy.createInterface<{ badMethod: () => Promise<void> }>();
    await expect(pxe.badMethod()).rejects.toThrow('interface error');
  });

  it('createInterface passes arguments through correctly', async () => {
    mockPXE.mockReturn('computeTaggingSecret', { secret: 'tagged' });
    const pxe = proxy.createInterface<{ computeTaggingSecret: (a: string, b: number) => Promise<unknown> }>();
    await pxe.computeTaggingSecret('addr', 42);

    const call = mockPXE.calls.find(c => c.method === 'computeTaggingSecret');
    expect(call?.args).toEqual(['addr', 42]);
  });
});

// ---------------------------------------------------------------------------
// Tests: TX_METHODS require approval
// ---------------------------------------------------------------------------

describe('PXEProxy + RPCHandler — TX method approval gate', () => {
  it('proveTx triggers popup approval before calling PXE', async () => {
    const trackingPopup = new MockPopupOrchestrator();
    const mockPXE = new MockPXE();
    mockPXE.mockReturn('proveTx', { proof: 'fake-proof' });

    const { proxy, parentChannel, iframeChannel } = await createConnectedPair(mockPXE, trackingPopup);

    await proxy.call('proveTx', [{ tx: 'data' }]);

    expect(trackingPopup.approvedTypes).toContain('sign');

    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('sendTx triggers popup approval before calling PXE', async () => {
    const trackingPopup = new MockPopupOrchestrator();
    const mockPXE = new MockPXE();
    mockPXE.mockReturn('sendTx', { txHash: '0xabcdef' });

    const { proxy, parentChannel, iframeChannel } = await createConnectedPair(mockPXE, trackingPopup);

    await proxy.call('sendTx', [{ tx: 'data' }]);

    expect(trackingPopup.approvedTypes).toContain('sign');

    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('proveTx is rejected when user cancels in popup', async () => {
    const rejectingPopup = new RejectingPopupOrchestrator();
    const mockPXE = new MockPXE();

    const { proxy, parentChannel, iframeChannel } = await createConnectedPair(mockPXE, rejectingPopup);

    await expect(proxy.call('proveTx', [])).rejects.toThrow('Transaction rejected by user');

    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('sendTx is rejected when user cancels in popup', async () => {
    const rejectingPopup = new RejectingPopupOrchestrator();
    const mockPXE = new MockPXE();

    const { proxy, parentChannel, iframeChannel } = await createConnectedPair(mockPXE, rejectingPopup);

    await expect(proxy.call('sendTx', [])).rejects.toThrow('Transaction rejected by user');

    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('regular method (getNodeInfo) does NOT trigger popup', async () => {
    const trackingPopup = new MockPopupOrchestrator();
    const mockPXE = new MockPXE();
    mockPXE.mockReturn('getNodeInfo', { version: '1' });

    const { proxy, parentChannel, iframeChannel } = await createConnectedPair(mockPXE, trackingPopup);

    await proxy.call('getNodeInfo', []);

    expect(trackingPopup.approvedTypes).toHaveLength(0);

    parentChannel.destroy();
    iframeChannel.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: handler resilience
// ---------------------------------------------------------------------------

describe('PXEProxy + RPCHandler — handler resilience', () => {
  let proxy: PXEProxy;
  let iframeChannel: SecureChannel;
  let parentChannel: SecureChannel;
  let mockPXE: MockPXE;

  beforeEach(async () => {
    mockPXE = new MockPXE();
    ({ proxy, iframeChannel, parentChannel } = await createConnectedPair(mockPXE, new MockPopupOrchestrator()));
  });

  afterEach(() => {
    parentChannel.destroy();
    iframeChannel.destroy();
  });

  it('one failed call does not prevent subsequent successful calls', async () => {
    mockPXE.mockThrow('badMethod', 'something went wrong');
    mockPXE.mockReturn('goodMethod', 'all good');

    await expect(proxy.call('badMethod', [])).rejects.toThrow();
    const result = await proxy.call('goodMethod', []);
    expect(result).toBe('all good');
  });

  it('returns undefined when PXE method returns undefined', async () => {
    mockPXE.mockReturn('voidMethod', undefined);
    const result = await proxy.call('voidMethod', []);
    expect(result).toBeUndefined();
  });

  it('passes through complex return types (objects, arrays)', async () => {
    const complexReturn = {
      accounts: [{ address: '0x1', balance: '100' }],
      block: { number: 42, hash: '0xdeadbeef' },
      flags: [true, false, true],
    };
    mockPXE.mockReturn('getFullState', complexReturn);
    const result = await proxy.call('getFullState', []);
    expect(result).toEqual(complexReturn);
  });

  it('many sequential mixed calls maintain correct state', async () => {
    mockPXE.mockReturn('methodA', 'a');
    mockPXE.mockReturn('methodB', 'b');
    mockPXE.mockThrow('methodC', 'error C');

    for (let i = 0; i < 10; i++) {
      expect(await proxy.call('methodA', [])).toBe('a');
      expect(await proxy.call('methodB', [])).toBe('b');
      await expect(proxy.call('methodC', [])).rejects.toThrow('error C');
    }
  });
});
