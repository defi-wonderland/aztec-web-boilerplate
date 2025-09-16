import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AzguardAccountAdapter } from '../../../src/services/aztec/wallet/AzguardAccountAdapter';
import { AzguardWalletService } from '../../../src/services/aztec/wallet/AzguardWalletService';
import { TestUtils, TEST_CONSTANTS } from '../../setup';

// Mock Aztec.js
const mockAztecAddress = {
  toString: () => TEST_CONSTANTS.MOCK_ADDRESS
};

vi.mock('@aztec/aztec.js', () => ({
  AztecAddress: {
    fromString: vi.fn(() => mockAztecAddress)
  }
}));

describe('AzguardAccountAdapter', () => {
  let adapter: AzguardAccountAdapter;
  let mockAzguardService: AzguardWalletService;

  beforeEach(() => {
    // Create mock service
    mockAzguardService = {
      executeOperations: vi.fn()
    } as any;

    adapter = new AzguardAccountAdapter(mockAzguardService);
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('CAIP account parsing', () => {
    it('extracts Aztec address from valid CAIP account', () => {
      // Arrange
      const caipAccount = TestUtils.createMockCaipAccount();

      // Act
      const address = adapter.getAztecAddress(caipAccount);

      // Assert
      expect(address.toString()).toBe(TEST_CONSTANTS.MOCK_ADDRESS);
    });

    it('throws error for invalid CAIP account format', () => {
      // Arrange
      const invalidAccount = 'invalid:format';

      // Act & Assert
      expect(() => adapter.getAztecAddress(invalidAccount as any)).toThrow('Invalid CAIP account format');
    });

    it('throws error for non-Aztec CAIP account', () => {
      // Arrange
      const nonAztecAccount = 'ethereum:1:0x1234567890abcdef1234567890abcdef12345678';

      // Act & Assert
      expect(() => adapter.getAztecAddress(nonAztecAccount as any)).toThrow('Invalid CAIP account format');
    });

    it('throws error for invalid address format', () => {
      // Arrange
      const invalidAddress = 'aztec:31337:invalid-address';

      // Act & Assert
      expect(() => adapter.getAztecAddress(invalidAddress as any)).toThrow('Invalid address format');
    });
  });

  describe('AccountWallet conversion', () => {
    it('creates AccountWallet proxy for valid CAIP account', async () => {
      // Arrange
      const caipAccount = TestUtils.createMockCaipAccount();

      // Act
      const accountWallet = await adapter.toAccountWallet(caipAccount);

      // Assert
      expect(accountWallet).toBeDefined();
      expect(typeof accountWallet.getAddress).toBe('function');
      expect(accountWallet.getAddress().toString()).toBe(TEST_CONSTANTS.MOCK_ADDRESS);
    });

    it('caches AccountWallet instances', async () => {
      // Arrange
      const caipAccount = TestUtils.createMockCaipAccount();

      // Act
      const wallet1 = await adapter.toAccountWallet(caipAccount);
      const wallet2 = await adapter.toAccountWallet(caipAccount);

      // Assert
      expect(wallet1).toBe(wallet2); // Should be the same instance from cache
    });

    it('returns cached AccountWallet when available', () => {
      // Arrange
      const caipAccount = TestUtils.createMockCaipAccount();

      // Act
      const cached = adapter.getCachedAccountWallet(caipAccount);

      // Assert
      expect(cached).toBeNull(); // No cache initially

      // After creating one
      adapter.toAccountWallet(caipAccount).then(() => {
        const cachedAfter = adapter.getCachedAccountWallet(caipAccount);
        expect(cachedAfter).toBeDefined();
      });
    });

    it('clears cache correctly', async () => {
      // Arrange
      const caipAccount = TestUtils.createMockCaipAccount();
      await adapter.toAccountWallet(caipAccount);

      // Act
      adapter.clearCache();

      // Assert
      const cached = adapter.getCachedAccountWallet(caipAccount);
      expect(cached).toBeNull();
    });
  });

  describe('operation execution', () => {
    it('executes operation successfully', async () => {
      // Arrange
      const operation = {
        kind: 'send_transaction' as const,
        account: TestUtils.createMockCaipAccount(),
        actions: []
      };

      const mockResult = { status: 'ok', result: 'success' };
      vi.mocked(mockAzguardService.executeOperations).mockResolvedValue([mockResult]);

      // Act
      const result = await adapter.executeOperation(operation);

      // Assert
      expect(mockAzguardService.executeOperations).toHaveBeenCalledWith([operation]);
      expect(result).toBe('success');
    });

    it('handles operation failure', async () => {
      // Arrange
      const operation = {
        kind: 'send_transaction' as const,
        account: TestUtils.createMockCaipAccount(),
        actions: []
      };

      const mockResult = { status: 'error', error: 'Operation failed' };
      vi.mocked(mockAzguardService.executeOperations).mockResolvedValue([mockResult]);

      // Act & Assert
      await expect(adapter.executeOperation(operation)).rejects.toThrow('Operation failed');
    });

    it('handles empty results', async () => {
      // Arrange
      const operation = {
        kind: 'send_transaction' as const,
        account: TestUtils.createMockCaipAccount(),
        actions: []
      };

      vi.mocked(mockAzguardService.executeOperations).mockResolvedValue([]);

      // Act & Assert
      await expect(adapter.executeOperation(operation)).rejects.toThrow('No results returned');
    });

    it('handles service errors', async () => {
      // Arrange
      const operation = {
        kind: 'send_transaction' as const,
        account: TestUtils.createMockCaipAccount(),
        actions: []
      };

      const error = new Error('Service error');
      vi.mocked(mockAzguardService.executeOperations).mockRejectedValue(error);

      // Act & Assert
      await expect(adapter.executeOperation(operation)).rejects.toThrow('Service error');
    });
  });

  describe('account deployment check', () => {
    it('checks account deployment status', async () => {
      // Arrange
      const caipAccount = TestUtils.createMockCaipAccount();

      // Act
      const isDeployed = await adapter.isAccountDeployed(caipAccount);

      // Assert
      expect(typeof isDeployed).toBe('boolean');
      // Currently returns false as placeholder implementation
      expect(isDeployed).toBe(false);
    });

    it('handles errors during deployment check', async () => {
      // Arrange
      const invalidAccount = 'invalid:format';

      // Act
      const isDeployed = await adapter.isAccountDeployed(invalidAccount as any);

      // Assert
      expect(isDeployed).toBe(false); // Should handle error gracefully
    });
  });

  describe('AccountWallet proxy methods', () => {
    let accountWallet: any;

    beforeEach(async () => {
      const caipAccount = TestUtils.createMockCaipAccount();
      accountWallet = await adapter.toAccountWallet(caipAccount);
    });

    it('proxy sendTransaction delegates to Azguard', async () => {
      // Arrange
      const txRequest = {
        to: '0x1234567890abcdef1234567890abcdef12345678',
        method: 'transfer',
        args: [100]
      };

      const mockResult = { status: 'ok', result: TEST_CONSTANTS.MOCK_TX_HASH };
      vi.mocked(mockAzguardService.executeOperations).mockResolvedValue([mockResult]);

      // Act
      const result = await accountWallet.sendTransaction(txRequest);

      // Assert
      expect(mockAzguardService.executeOperations).toHaveBeenCalled();
      expect(result).toBe(TEST_CONSTANTS.MOCK_TX_HASH);
    });

    it('proxy simulateCall delegates to Azguard', async () => {
      // Arrange
      const callRequest = {
        contract: '0x1234567890abcdef1234567890abcdef12345678',
        method: 'balanceOf',
        args: ['0xuser']
      };

      const mockResult = { status: 'ok', result: 'simulation-result' };
      vi.mocked(mockAzguardService.executeOperations).mockResolvedValue([mockResult]);

      // Act
      const result = await accountWallet.simulateCall(callRequest);

      // Assert
      expect(mockAzguardService.executeOperations).toHaveBeenCalled();
      expect(result).toBe('simulation-result');
    });
  });

  describe('cleanup', () => {
    it('cleans up resources on destroy', () => {
      // Arrange
      const caipAccount = TestUtils.createMockCaipAccount();
      adapter.toAccountWallet(caipAccount);

      // Act
      adapter.destroy();

      // Assert
      const cached = adapter.getCachedAccountWallet(caipAccount);
      expect(cached).toBeNull();
    });
  });
});
