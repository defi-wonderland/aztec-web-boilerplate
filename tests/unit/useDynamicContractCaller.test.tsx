// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useDynamicContractCaller } from '../../src/hooks/contracts/useDynamicContractCaller';

vi.mock('../../src/hooks/context/useUniversalWallet', () => ({
  useUniversalWallet: () => ({
    connector: null,
    account: null,
  }),
}));

// Enable React act environment for the test runner
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const renderHook = <T,>(hook: () => T) => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const result: { current: T | undefined } = { current: undefined };

  act(() => {
    root.render(<HookHarness hook={hook} result={result} />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
};

function HookHarness<T>({
  hook,
  result,
}: {
  hook: () => T;
  result: { current: T | undefined };
}) {
  result.current = hook();
  return null;
}

describe('useDynamicContractCaller', () => {
  it('returns error when wallet is not connected', async () => {
    const { result, unmount } = renderHook(() => useDynamicContractCaller(null));
    const hookResult = result.current;

    if (!hookResult) {
      throw new Error('Hook did not render');
    }

    let simulateResult;
    await act(async () => {
      simulateResult = await hookResult.simulate({
        address: '0x',
        functionName: 'foo',
        args: [],
      });
    });

    expect(simulateResult.success).toBe(false);
    expect(simulateResult.error).toContain('Wallet not connected');

    let executeResult;
    await act(async () => {
      executeResult = await hookResult.execute({
        address: '0x',
        functionName: 'foo',
        args: [],
      });
    });

    expect(executeResult.success).toBe(false);
    expect(executeResult.error).toContain('Wallet not connected');
    unmount();
  });
});
