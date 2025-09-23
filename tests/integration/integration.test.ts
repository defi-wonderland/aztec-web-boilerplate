/**
 * Integration tests for Azguard wallet types with existing Aztec types
 * Verifies that all type interfaces work together correctly
 */

import type { AccountWallet } from '@aztec/aztec.js';
import {
  WalletType,
  type IAzguardWalletService,
  type IAzguardAccountAdapter,
  type IUniversalWallet
} from '../../src/types/aztec';
import type {
  AzguardWalletState,
  AzguardWalletContextType,
  CaipAccount,
  AzguardClient
} from '../../src/types/azguard';
import { TestUtils, TEST_CONSTANTS } from '../setup';
import { describe, it, expect } from 'vitest';

/**
 * Integration test suite for Azguard and Aztec type compatibility
 */
describe('Azguard-Aztec Type Integration', () => {
  describe('Universal Wallet Interface', () => {
    it('creates Azguard universal wallet implementation', () => {
      const mockUniversalWallet: IUniversalWallet = {
        type: WalletType.AZGUARD,
        isConnected: false,
        account: null,
        connect: async (): Promise<AccountWallet> => {
          throw new Error('Mock implementation');
        },
        disconnect: async (): Promise<void> => {
          // Mock implementation
        },
        sendTransaction: async (params: any): Promise<string> => {
          return TEST_CONSTANTS.MOCK_TX_HASH;
        },
        simulateCall: async (params: any): Promise<any> => {
          return { result: 'mock-result' };
        }
      };

      expect(mockUniversalWallet.type).toBe(WalletType.AZGUARD);
      expect(mockUniversalWallet.isConnected).toBe(false);
      expect(mockUniversalWallet.account).toBeNull();
      expect(typeof mockUniversalWallet.connect).toBe('function');
      expect(typeof mockUniversalWallet.disconnect).toBe('function');
    });

    it('handles transaction operations', async () => {
      const mockUniversalWallet: IUniversalWallet = {
        type: WalletType.AZGUARD,
        isConnected: true,
        account: null,
        connect: async () => null as any,
        disconnect: async () => {},
        sendTransaction: async (params: any): Promise<string> => {
          return TEST_CONSTANTS.MOCK_TX_HASH;
        },
        simulateCall: async (params: any): Promise<any> => {
          return { result: 'simulation-result' };
        }
      };

      const txHash = await mockUniversalWallet.sendTransaction({});
      const simulationResult = await mockUniversalWallet.simulateCall({});

      expect(txHash).toBe(TEST_CONSTANTS.MOCK_TX_HASH);
      expect(simulationResult.result).toBe('simulation-result');
    });
  });

  describe('Azguard Wallet Service Interface', () => {
    it('implements required service methods', () => {
      const mockService: Partial<IAzguardWalletService> = {
        initialize: async (): Promise<void> => {
          // Mock initialization
        },
        isInstalled: async (): Promise<boolean> => {
          return false;
        },
        getAccounts: async (): Promise<CaipAccount[]> => {
          return [TestUtils.createMockCaipAccount()];
        },
        getSupportedChains: (): string[] => {
          return [TEST_CONSTANTS.MOCK_CHAIN_ID, TEST_CONSTANTS.MOCK_TESTNET_CHAIN_ID];
        }
      };

      expect(typeof mockService.initialize).toBe('function');
      expect(typeof mockService.isInstalled).toBe('function');
      expect(typeof mockService.getAccounts).toBe('function');
      expect(typeof mockService.getSupportedChains).toBe('function');
    });

    it('returns expected data types', async () => {
      const mockService: Partial<IAzguardWalletService> = {
        isInstalled: async () => true,
        getAccounts: async () => [TestUtils.createMockCaipAccount()],
        getSupportedChains: () => [TEST_CONSTANTS.MOCK_CHAIN_ID]
      };

      const isInstalled = await mockService.isInstalled!();
      const accounts = await mockService.getAccounts!();
      const chains = mockService.getSupportedChains!();

      expect(typeof isInstalled).toBe('boolean');
      expect(Array.isArray(accounts)).toBe(true);
      expect(Array.isArray(chains)).toBe(true);
      expect(accounts[0]).toMatch(/^aztec:\d+:0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Azguard Account Adapter Interface', () => {
    it('implements adapter methods', () => {
      const mockAdapter: Partial<IAzguardAccountAdapter> = {
        executeOperation: async (operation: any): Promise<any> => {
          return { status: 'ok', result: 'mock-result' };
        },
        isAccountDeployed: async (caipAccount: CaipAccount): Promise<boolean> => {
          return false;
        }
      };

      expect(typeof mockAdapter.executeOperation).toBe('function');
      expect(typeof mockAdapter.isAccountDeployed).toBe('function');
    });

    it('handles operation execution', async () => {
      const mockAdapter: Partial<IAzguardAccountAdapter> = {
        executeOperation: async (operation: any) => {
          return { status: 'ok', result: operation.kind };
        },
        isAccountDeployed: async (caipAccount: CaipAccount) => {
          return caipAccount.includes('0xdeployed123');
        }
      };

      const result = await mockAdapter.executeOperation!({ kind: 'send_transaction' } as any);
      const isDeployed = await mockAdapter.isAccountDeployed!('aztec:31337:0xdeployed123' as any);
      const isNotDeployed = await mockAdapter.isAccountDeployed!('aztec:31337:0xnotdeployed' as any);

      expect(result.status).toBe('ok');
      expect(result.result).toBe('send_transaction');
      expect(isDeployed).toBe(true);
      expect(isNotDeployed).toBe(false);
    });
  });

  describe('Azguard Wallet Context Integration', () => {
    it('creates complete context with all required properties', () => {
      const mockState: AzguardWalletState = TestUtils.createMockAzguardState({
        supportedChains: [TEST_CONSTANTS.MOCK_CHAIN_ID]
      });

      const mockContext: Partial<AzguardWalletContextType> = {
        state: mockState,
        client: null,
        connect: async (): Promise<void> => {
          // Mock connect
        },
        disconnect: async (): Promise<void> => {
          // Mock disconnect
        },
        executeOperations: async (operations: any[]): Promise<any[]> => {
          return operations.map(() => ({ status: 'ok', result: 'mock' }));
        }
      };

      expect(mockContext.state).toBeDefined();
      expect(mockContext.client).toBeNull();
      expect(typeof mockContext.connect).toBe('function');
      expect(typeof mockContext.disconnect).toBe('function');
      expect(typeof mockContext.executeOperations).toBe('function');
    });

    it('handles operation execution through context', async () => {
      const mockContext: Partial<AzguardWalletContextType> = {
        state: TestUtils.createMockAzguardState(),
        executeOperations: async (operations: any[]) => {
          return operations.map((op, index) => ({ 
            status: 'ok', 
            result: `result-${index}`,
            operationKind: op.kind 
          }));
        }
      };

      const operations = [
        { kind: 'send_transaction' } as any,
        { kind: 'simulate_views' } as any
      ];

      const results = await mockContext.executeOperations!(operations);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('ok');
      expect((results[0] as any).result).toBe('result-0');
      expect((results[1] as any).result).toBe('result-1');
    });
  });
});

/**
 * Legacy integration test class for backward compatibility
 */
export class Phase1IntegrationTest {
  static runAllTests(): boolean {
    try {
      // Basic type instantiation tests
      const state = TestUtils.createMockAzguardState();
      const config = TestUtils.createMockConnectionConfig();
      const account = TestUtils.createMockCaipAccount();
      
      return (
        typeof state === 'object' &&
        typeof config === 'object' &&
        typeof account === 'string' &&
        WalletType.AZGUARD === 'azguard'
      );
    } catch (error) {
      console.error('Phase 1 integration test failed:', error);
      return false;
    }
  }
}

// Export test results for backward compatibility
export const phase1TestResults = {
  passed: Phase1IntegrationTest.runAllTests(),
  timestamp: new Date().toISOString()
};
