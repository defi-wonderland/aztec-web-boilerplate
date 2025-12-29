/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWriteContract } from '../../../src/hooks/contracts/useWriteContract';
import { WalletType } from '../../../src/types/aztec';

let universalMock: any = {};
const contractAt = vi.fn();

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
type MockMethodName = 'mint';
const baseParams = {
  contract: {
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
  },
  address: TEST_ADDRESS,
  functionName: 'mint' as MockMethodName,
  args: [1n],
};

describe('useWriteContract', () => {
  beforeEach(() => {
    universalMock = { connector: null, account: null };
    contractAt.mockReset();
  });

  it('returns error when wallet is not connected', async () => {
    const { result } = renderHook(() => useWriteContract());

    const params = baseParams as unknown as Parameters<
      ReturnType<typeof useWriteContract>['writeContract']
    >[0];
    const response = await result.current.writeContract(params);

    expect(response).toEqual({ success: false, error: 'Wallet not connected' });
  });

  it('succeeds for browser wallet and waits for receipt', async () => {
    const sendTransaction = vi.fn().mockResolvedValue({
      status: 'success',
      txHash: '0xtx',
      rawResult: 'raw',
    });
    const executeOperation = vi.fn().mockResolvedValue({
      status: 'ok',
      result: { status: 'mined' },
    });

    universalMock = {
      connector: {
        type: WalletType.BROWSER_WALLET,
        sendTransaction,
        getCaipAccount: () => 'aztec:0:acc',
        executeOperation,
      },
      account: { getAddress: () => TEST_ACCOUNT },
    };

    const { result } = renderHook(() => useWriteContract({ receiptPolling: { maxAttempts: 1, intervalMs: 0 } }));

    const params = baseParams as unknown as Parameters<
      ReturnType<typeof useWriteContract>['writeContract']
    >[0];
    const response = await result.current.writeContract(params);

    expect(response).toEqual({ success: true, txHash: '0xtx', data: 'raw' });
    expect(sendTransaction).toHaveBeenCalled();
    expect(executeOperation).toHaveBeenCalled();
  });

  it('returns error for browser wallet failure', async () => {
    const sendTransaction = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'bad',
    });

    universalMock = {
      connector: {
        type: WalletType.BROWSER_WALLET,
        sendTransaction,
        getCaipAccount: () => 'aztec:0:acc',
        executeOperation: vi.fn(),
      },
      account: { getAddress: () => TEST_ACCOUNT },
    };

    const { result } = renderHook(() => useWriteContract());

    const params = baseParams as unknown as Parameters<
      ReturnType<typeof useWriteContract>['writeContract']
    >[0];
    const response = await result.current.writeContract(params);

    expect(response).toEqual({ success: false, error: 'bad' });
  });

  it('succeeds for app-managed PXE wallet (embedded/external)', async () => {
    const mockWait = vi.fn().mockResolvedValue('ok');
    const mockSend = vi.fn(() => ({ wait: mockWait }));
    const mockMethod = vi.fn(() => ({ send: mockSend }));

    contractAt.mockResolvedValueOnce({
      methods: { mint: mockMethod },
    });

    const getSponsoredFeePaymentMethod = vi.fn().mockResolvedValue({ pm: true });

    universalMock = {
      connector: {
        type: WalletType.EMBEDDED,
        getWallet: () => ({ id: 'wallet' }),
        getSponsoredFeePaymentMethod,
      },
      account: { getAddress: () => TEST_ACCOUNT },
    };

    const { result } = renderHook(() => useWriteContract());

    const params = baseParams as unknown as Parameters<
      ReturnType<typeof useWriteContract>['writeContract']
    >[0];
    const response = await result.current.writeContract(params);

    expect(response).toEqual({ success: true, data: 'ok' });
    expect(contractAt).toHaveBeenCalled();
    expect(mockMethod).toHaveBeenCalledWith(...baseParams.args as any);
    expect(mockSend).toHaveBeenCalledWith({
      from: TEST_ACCOUNT,
      fee: { paymentMethod: { pm: true } },
    });
    expect(mockWait).toHaveBeenCalledWith({ timeout: 900 });
  });

  it('returns error when method is missing', async () => {
    contractAt.mockResolvedValueOnce({
      methods: {},
    });

    universalMock = {
      connector: {
        type: WalletType.EMBEDDED,
        getWallet: () => ({ id: 'wallet' }),
        getSponsoredFeePaymentMethod: vi.fn().mockResolvedValue({ pm: true }),
      },
      account: { getAddress: () => '0xacc' },
    };

    const { result } = renderHook(() => useWriteContract());

    const params = baseParams as unknown as Parameters<
      ReturnType<typeof useWriteContract>['writeContract']
    >[0];
    const response = await result.current.writeContract(params);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Method mint not found');
  });
});

