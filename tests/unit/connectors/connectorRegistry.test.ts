import { describe, expect, it, vi } from 'vitest';
import {
  ConnectorRegistry,
  createConnectorRegistry,
  type ConnectorFactory,
} from '../../../src/connectors/registry';
import type { WalletConnector, ConnectorStatus } from '../../../src/types/walletConnector';
import { WalletType } from '../../../src/types/aztec';

const createStubConnector = (id: string, hasAccount = false): WalletConnector => {
  const status: ConnectorStatus = { isInstalled: true, status: 'connected', error: null };
  const account = hasAccount ? ({ getAddress: () => id } as any) : null;
  const noop = vi.fn(async () => {});

  return {
    id,
    label: id,
    type: WalletType.EMBEDDED,
    getStatus: vi.fn(() => status),
    getAccount: vi.fn(() => account),
    getCaipAccount: vi.fn(() => null),
    connect: noop,
    disconnect: noop,
    sendTransaction: vi.fn(async () => ({ status: 'success' as const })),
  };
};

describe('ConnectorRegistry connector selection', () => {
  it('getActiveConnector returns the first with an account', () => {
    const factories: ConnectorFactory[] = [
      () => createStubConnector('a', false),
      () => createStubConnector('b', true),
      () => createStubConnector('c', true),
    ];

    const registry = createConnectorRegistry(factories);
    const active = registry.getActiveConnector();

    expect(active?.id).toBe('b');
  });

  it('getConnector returns undefined for unknown id', () => {
    const registry = createConnectorRegistry([() => createStubConnector('a')]);
    expect(registry.getConnector('missing' as never)).toBeUndefined();
  });
});


