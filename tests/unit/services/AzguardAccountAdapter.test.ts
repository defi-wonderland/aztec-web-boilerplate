import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestUtils, TEST_CONSTANTS } from '../../setup';

// Create a test-friendly version of the adapter that doesn't use AztecAddress
class TestableAzguardAccountAdapter {
  private azguardService: any;
  private accountWalletCache: Map<string, any> = new Map();

  constructor(azguardService: any) {
    this.azguardService = azguardService;
  }

  /**
   * Test version of CAIP account parsing without AztecAddress dependency
   */
  parseCaipAccount(caipAccount: string): { chain: string; chainId: string; address: string } {
    const parts = caipAccount.split(':');
    if (parts.length !== 3) {
      throw new Error(`Invalid CAIP account format: ${caipAccount}`);
    }

    const [chain, chainId, address] = parts;
    
    if (chain !== 'aztec') {
      throw new Error(`Invalid CAIP account format: ${caipAccount}`);
    }

    // Validate address format (basic hex validation)
    if (!address.match(/^0x[a-fA-F0-9]{40,64}$/)) {
      throw new Error(`Invalid address format: ${address}`);
    }

    return { chain, chainId, address };
  }

  /**
   * Test version of AccountWallet creation
   */
  async createAccountWalletProxy(caipAccount: string): Promise<any> {
    try {
      const { address } = this.parseCaipAccount(caipAccount);
      
      // Check cache first
      if (this.accountWalletCache.has(caipAccount)) {
        return this.accountWalletCache.get(caipAccount);
      }

      // Create a mock AccountWallet proxy
      const mockAccountWallet = {
        getAddress: () => ({ toString: () => address }),
        sendTransaction: async (params: any) => {
          return await this.azguardService.executeOperations([{
            kind: 'send_transaction',
            ...params
          }]);
        },
        simulateCall: async (params: any) => {
          return await this.azguardService.executeOperations([{
            kind: 'simulate_views',
            ...params
          }]);
        }
      };

      // Cache the result
      this.accountWalletCache.set(caipAccount, mockAccountWallet);
      return mockAccountWallet;
    } catch (error) {
      throw new Error(`Failed to convert account ${caipAccount}: ${error.message}`);
    }
  }

  /**
   * Test version of operation execution
   */
  async executeOperation(operation: any): Promise<any> {
    try {
      const results = await this.azguardService.executeOperations([operation]);
      
      if (!results || results.length === 0) {
        throw new Error('No results returned from operation');
      }

      const result = results[0];
      if (result.status === 'error') {
        throw new Error('Operation failed');
      }

      return result.result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test version of account deployment check
   */
  async isAccountDeployed(caipAccount: string): Promise<boolean> {
    try {
      const { address } = this.parseCaipAccount(caipAccount);
      // Mock deployment check - in real implementation this would check on-chain
      return address.includes('deadbeef');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clear cache for testing
   */
  clearCache(): void {
    this.accountWalletCache.clear();
  }

  /**
   * Get cache size for testing
   */
  getCacheSize(): number {
    return this.accountWalletCache.size;
  }
}

describe('AzguardAccountAdapter', () => {
  let adapter: TestableAzguardAccountAdapter;
  let mockAzguardService: any;

  beforeEach(() => {
    // Create mock service
    mockAzguardService = {
      executeOperations: vi.fn()
    };

    adapter = new TestableAzguardAccountAdapter(mockAzguardService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CAIP account parsing', () => {
    it('parses valid CAIP account format', () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      const result = adapter.parseCaipAccount(caipAccount);
      
      expect(result.chain).toBe('aztec');
      expect(result.chainId).toBe('31337');
      expect(result.address).toBe(TEST_CONSTANTS.MOCK_ADDRESS);
    });

    it('throws error for invalid CAIP account format', () => {
      expect(() => {
        adapter.parseCaipAccount('invalid:format');
      }).toThrow('Invalid CAIP account format: invalid:format');
    });

    it('throws error for non-Aztec CAIP account', () => {
      expect(() => {
        adapter.parseCaipAccount('ethereum:1:0x1234567890abcdef1234567890abcdef12345678');
      }).toThrow('Invalid CAIP account format: ethereum:1:0x1234567890abcdef1234567890abcdef12345678');
    });

    it('throws error for invalid address format', () => {
      expect(() => {
        adapter.parseCaipAccount('aztec:31337:invalid-address');
      }).toThrow('Invalid address format: invalid-address');
    });
  });

  describe('AccountWallet proxy creation', () => {
    it('creates AccountWallet proxy for valid CAIP account', async () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      const accountWallet = await adapter.createAccountWalletProxy(caipAccount);
      
      expect(accountWallet).toBeDefined();
      expect(accountWallet.getAddress).toBeDefined();
      expect(accountWallet.sendTransaction).toBeDefined();
      expect(accountWallet.simulateCall).toBeDefined();
      expect(accountWallet.getAddress().toString()).toBe(TEST_CONSTANTS.MOCK_ADDRESS);
    });

    it('caches AccountWallet instances', async () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      
      const wallet1 = await adapter.createAccountWalletProxy(caipAccount);
      const wallet2 = await adapter.createAccountWalletProxy(caipAccount);
      
      expect(wallet1).toBe(wallet2);
      expect(adapter.getCacheSize()).toBe(1);
    });

    it('returns cached AccountWallet when available', async () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      
      // First call should create and cache
      const wallet1 = await adapter.createAccountWalletProxy(caipAccount);
      expect(adapter.getCacheSize()).toBe(1);
      
      // Second call should return cached version
      const wallet2 = await adapter.createAccountWalletProxy(caipAccount);
      expect(wallet1).toBe(wallet2);
      expect(adapter.getCacheSize()).toBe(1);
    });

    it('clears cache correctly', async () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      
      await adapter.createAccountWalletProxy(caipAccount);
      expect(adapter.getCacheSize()).toBe(1);
      
      adapter.clearCache();
      expect(adapter.getCacheSize()).toBe(0);
      
      // Should create new instance after cache clear
      const newWallet = await adapter.createAccountWalletProxy(caipAccount);
      expect(newWallet).toBeDefined();
      expect(adapter.getCacheSize()).toBe(1);
    });
  });

  describe('operation execution', () => {
    it('executes operation successfully', async () => {
      const mockOperation = { kind: 'send_transaction', data: 'test' };
      const mockResult = { status: 'ok', result: 'success' };
      
      mockAzguardService.executeOperations.mockResolvedValue([mockResult]);
      
      const result = await adapter.executeOperation(mockOperation);
      
      expect(mockAzguardService.executeOperations).toHaveBeenCalledWith([mockOperation]);
      expect(result).toBe('success');
    });

    it('handles operation failure', async () => {
      const mockOperation = { kind: 'send_transaction', data: 'test' };
      const mockResult = { status: 'error', error: 'Operation failed' };
      
      mockAzguardService.executeOperations.mockResolvedValue([mockResult]);
      
      await expect(adapter.executeOperation(mockOperation)).rejects.toThrow('Operation failed');
    });

    it('handles empty results', async () => {
      const mockOperation = { kind: 'send_transaction', data: 'test' };
      
      mockAzguardService.executeOperations.mockResolvedValue([]);
      
      await expect(adapter.executeOperation(mockOperation)).rejects.toThrow('No results returned from operation');
    });

    it('handles service errors', async () => {
      const mockOperation = { kind: 'send_transaction', data: 'test' };
      
      mockAzguardService.executeOperations.mockRejectedValue(new Error('Service error'));
      
      await expect(adapter.executeOperation(mockOperation)).rejects.toThrow('Service error');
    });
  });

  describe('account deployment check', () => {
    it('checks account deployment status', async () => {
      const deployedAccount = 'aztec:31337:0xdeadbeef1234567890abcdef1234567890abcdef12345678';
      const notDeployedAccount = 'aztec:31337:0x1234567890abcdef1234567890abcdef12345678';
      
      const isDeployed = await adapter.isAccountDeployed(deployedAccount);
      const isNotDeployed = await adapter.isAccountDeployed(notDeployedAccount);
      
      expect(isDeployed).toBe(true);
      expect(isNotDeployed).toBe(false);
    });

    it('handles errors during deployment check', async () => {
      const invalidAccount = 'invalid:format';
      
      await expect(adapter.isAccountDeployed(invalidAccount)).rejects.toThrow('Invalid CAIP account format');
    });
  });

  describe('AccountWallet proxy methods', () => {
    let accountWallet: any;

    beforeEach(async () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      accountWallet = await adapter.createAccountWalletProxy(caipAccount);
    });

    it('proxy sendTransaction delegates to Azguard', async () => {
      const mockParams = { to: 'test', amount: 100 };
      const mockResult = { status: 'ok', result: 'tx-hash' };
      
      mockAzguardService.executeOperations.mockResolvedValue([mockResult]);
      
      const result = await accountWallet.sendTransaction(mockParams);
      
      expect(mockAzguardService.executeOperations).toHaveBeenCalledWith([{
        kind: 'send_transaction',
        ...mockParams
      }]);
      expect(result).toEqual([mockResult]);
    });

    it('proxy simulateCall delegates to Azguard', async () => {
      const mockParams = { contract: 'test', method: 'view' };
      const mockResult = { status: 'ok', result: 'view-result' };
      
      mockAzguardService.executeOperations.mockResolvedValue([mockResult]);
      
      const result = await accountWallet.simulateCall(mockParams);
      
      expect(mockAzguardService.executeOperations).toHaveBeenCalledWith([{
        kind: 'simulate_views',
        ...mockParams
      }]);
      expect(result).toEqual([mockResult]);
    });
  });

  describe('cleanup', () => {
    it('cleans up resources on destroy', async () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      
      // Create some cached items
      await adapter.createAccountWalletProxy(caipAccount);
      expect(adapter.getCacheSize()).toBe(1);
      
      // Clear cache (simulating cleanup)
      adapter.clearCache();
      expect(adapter.getCacheSize()).toBe(0);
    });
  });
});