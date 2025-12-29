/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReadContract } from '../../../src/hooks/contracts/useReadContract';
import { WalletType } from '../../../src/types/aztec';

let universalMock: any = {};
const contractAt = vi.fn();
const mockContract = {
  artifact: {
    name: 'MockContract',
    functions: [],
    nonDispatchPublicFunctions: [],
    outputs: { structs: {}, globals: {} },
    constructor: { name: 'constructor', inputs: [], functionType: 'secret' },
    storageLayout: {},
    fileMap: {},
  },
  at: vi.fn(),
};

vi.mock('../../../src/hooks/context/useUniversalWallet', () => ({
  useUniversalWallet: () => universalMock,
}));

vi.mock('@aztec/aztec.js/contracts', () => ({
  Contract: {
    at: (...args: unknown[]) => contractAt(...args),
  },
}));

const TEST_ADDRESS =
  '0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000';
const TEST_ACCOUNT =
  '0xaaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff';
const baseParams = {
  contract: mockContract,
  address: TEST_ADDRESS,
  functionName: 'balance_of',
  args: [TEST_ACCOUNT],
};

describe('useReadContract', () => {
  beforeEach(() => {
    universalMock = { connector: null, account: null, currentConfig: { name: 'devnet' } };
    contractAt.mockReset();
  });

  it('returns error when wallet is not connected', async () => {
    const { result } = renderHook(() => useReadContract());

    const response = await result.current.readContract(baseParams);

    expect(response).toEqual({ success: false, error: 'Wallet not connected' });
  });

  it('succeeds for browser wallet simulate_views', async () => {
    const executeOperation = vi.fn().mockResolvedValue({
      status: 'ok',
      result: { decoded: [123n] },
    });

    universalMock = {
      connector: {
        type: WalletType.BROWSER_WALLET,
        getCaipAccount: () => 'aztec:0:acc',
        executeOperation,
      },
      account: { getAddress: () => TEST_ACCOUNT },
      currentConfig: { name: 'devnet' },
      walletType: WalletType.BROWSER_WALLET,
    };

    const { result } = renderHook(() => useReadContract());

    const response = await result.current.readContract(baseParams);

    expect(response).toEqual({ success: true, data: { decoded: [123n] } });
    expect(executeOperation).toHaveBeenCalled();
  });

  it('returns error when browser wallet operation fails', async () => {
    const executeOperation = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'boom',
    });

    universalMock = {
      connector: {
        type: WalletType.BROWSER_WALLET,
        getCaipAccount: () => 'aztec:0:acc',
        executeOperation,
      },
      account: { getAddress: () => TEST_ACCOUNT },
      currentConfig: { name: 'devnet' },
      walletType: WalletType.BROWSER_WALLET,
    };

    const { result } = renderHook(() => useReadContract());

    const response = await result.current.readContract(baseParams);

    expect(response).toEqual({ success: false, error: 'boom' });
  });

  it('succeeds for app-managed PXE wallet', async () => {
    const mockSimulate = vi.fn().mockResolvedValue(999n);
    const mockMethod = vi.fn(() => ({ simulate: mockSimulate }));

    contractAt.mockResolvedValueOnce({
      methods: { balance_of: mockMethod },
    });

    universalMock = {
      connector: {
        type: WalletType.EMBEDDED,
        getWallet: () => ({ id: 'wallet' }),
      },
      account: { getAddress: () => '0xacc' },
      currentConfig: { name: 'devnet' },
      walletType: WalletType.EMBEDDED,
    };

    const { result } = renderHook(() => useReadContract());

    const response = await result.current.readContract(baseParams);

    expect(response).toEqual({ success: true, data: 999n });
    expect(contractAt).toHaveBeenCalled();
    expect(mockMethod).toHaveBeenCalledWith(...baseParams.args as any);
    expect(mockSimulate).toHaveBeenCalledWith({ from: '0xacc' });
  });

  it('returns error when method is missing for app-managed PXE', async () => {
    contractAt.mockResolvedValueOnce({
      methods: {},
    });

    universalMock = {
      connector: {
        type: WalletType.EMBEDDED,
        getWallet: () => ({ id: 'wallet' }),
      },
      account: { getAddress: () => '0xacc' },
      currentConfig: { name: 'devnet' },
      walletType: WalletType.EMBEDDED,
    };

    const { result } = renderHook(() => useReadContract());

    const response = await result.current.readContract(baseParams);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Method balance_of not found');
  });
});

