import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AzguardWalletService } from '../../../src/services/aztec/wallet/AzguardWalletService';
import { TestUtils, TEST_CONSTANTS } from '../../setup';

// Mock the AzguardClient
vi.mock('@azguardwallet/client', () => ({
  AzguardClient: {
    isAzguardInstalled: vi.fn(),
    create: vi.fn()
  }
}));

describe('AzguardWalletService', () => {
  let service: AzguardWalletService;
  let mockClient: any;

  beforeEach(() => {
    service = new AzguardWalletService();
    
    // Create mock client
    mockClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      execute: vi.fn(),
      accounts: [],
      onDisconnected: {
        addHandler: vi.fn(),
        removeHandler: vi.fn(),
      },
      onAccountsChanged: {
        addHandler: vi.fn(),
        removeHandler: vi.fn(),
      },
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('initialization', () => {
    it('initializes successfully when Azguard is installed', async () => {
      // Arrange
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(true);
      vi.mocked(AzguardClient.create).mockResolvedValue(mockClient);

      // Act
      await service.initialize();

      // Assert
      expect(AzguardClient.isAzguardInstalled).toHaveBeenCalled();
      expect(AzguardClient.create).toHaveBeenCalled();
      expect(mockClient.onAccountsChanged.addHandler).toHaveBeenCalled();
      expect(mockClient.onDisconnected.addHandler).toHaveBeenCalled();
      
      const state = service.getState();
      expect(state.isInstalled).toBe(true);
      expect(state.supportedChains).toContain('aztec:0');
    });

    it('handles case when Azguard is not installed', async () => {
      // Arrange
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(false);

      // Act
      await service.initialize();

      // Assert
      expect(AzguardClient.create).not.toHaveBeenCalled();
      
      const state = service.getState();
      expect(state.isInstalled).toBe(false);
      expect(state.error).toContain('not installed');
    });

    it('handles initialization errors gracefully', async () => {
      // Arrange
      const { AzguardClient } = await import('@azguardwallet/client');
      const error = new Error('Initialization failed');
      vi.mocked(AzguardClient.isAzguardInstalled).mockRejectedValue(error);

      // Act & Assert
      await expect(service.initialize()).rejects.toThrow('Initialization failed');
      
      const state = service.getState();
      expect(state.error).toBe('Initialization failed');
    });
  });

  describe('installation check', () => {
    it('returns true when Azguard is installed', async () => {
      // Arrange
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(true);

      // Act
      const isInstalled = await service.isInstalled();

      // Assert
      expect(isInstalled).toBe(true);
      expect(service.getState().isInstalled).toBe(true);
    });

    it('returns false when Azguard is not installed', async () => {
      // Arrange
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(false);

      // Act
      const isInstalled = await service.isInstalled();

      // Assert
      expect(isInstalled).toBe(false);
      expect(service.getState().isInstalled).toBe(false);
    });

    it('handles errors during installation check', async () => {
      // Arrange
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockRejectedValue(new Error('Check failed'));

      // Act
      const isInstalled = await service.isInstalled();

      // Assert
      expect(isInstalled).toBe(false);
    });
  });

  describe('connection', () => {
    beforeEach(async () => {
      // Initialize service with mock client
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(true);
      vi.mocked(AzguardClient.create).mockResolvedValue(mockClient);
      await service.initialize();
    });

    it('connects successfully and returns accounts', async () => {
      // Arrange
      const mockAccounts = [
        TestUtils.createMockCaipAccount(),
        TestUtils.createMockCaipAccount('aztec:0', '0xabcdef1234567890abcdef1234567890abcdef12')
      ];
      
      mockClient.connect = vi.fn().mockResolvedValue(undefined);
      mockClient.accounts = mockAccounts;

      const dappMetadata = { name: 'Test Dapp' };
      const permissions = [{ chains: ['aztec:0'], methods: ['send_transaction'] }];

      // Act
      const accounts = await service.connect(dappMetadata, permissions);

      // Assert
      expect(mockClient.connect).toHaveBeenCalledWith(dappMetadata, permissions);
      expect(accounts).toEqual(mockAccounts);
      
      const state = service.getState();
      expect(state.isConnected).toBe(true);
      expect(state.accounts).toEqual(mockAccounts);
      expect(state.selectedAccount).toBe(mockAccounts[0]);
    });

    it('handles connection errors', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockClient.connect = vi.fn().mockRejectedValue(error);
      
      const dappMetadata = { name: 'Test Dapp' };
      const permissions = [{ chains: ['aztec:0'], methods: ['send_transaction'] }];

      // Act & Assert
      await expect(service.connect(dappMetadata, permissions)).rejects.toThrow('Connection failed');
      
      const state = service.getState();
      expect(state.isConnecting).toBe(false);
      expect(state.error).toBe('Connection failed');
    });

    it('throws error when service not initialized', async () => {
      // Arrange
      const uninitializedService = new AzguardWalletService();
      const dappMetadata = { name: 'Test Dapp' };
      const permissions = [{ chains: ['aztec:0'], methods: ['send_transaction'] }];

      // Act & Assert
      await expect(uninitializedService.connect(dappMetadata, permissions)).rejects.toThrow('not initialized');
    });
  });

  describe('disconnection', () => {
    beforeEach(async () => {
      // Initialize and connect
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(true);
      vi.mocked(AzguardClient.create).mockResolvedValue(mockClient);
      await service.initialize();
      
      mockClient.accounts = [TestUtils.createMockCaipAccount()];
      const dappMetadata = { name: 'Test Dapp' };
      const permissions = [{ chains: ['aztec:0'], methods: ['send_transaction'] }];
      await service.connect(dappMetadata, permissions);
    });

    it('disconnects successfully', async () => {
      // Arrange
      mockClient.disconnect = vi.fn().mockResolvedValue(undefined);

      // Act
      await service.disconnect();

      // Assert
      expect(mockClient.disconnect).toHaveBeenCalled();
      
      const state = service.getState();
      expect(state.isConnected).toBe(false);
      expect(state.accounts).toEqual([]);
      expect(state.selectedAccount).toBeNull();
    });

    it('handles disconnection errors', async () => {
      // Arrange
      const error = new Error('Disconnection failed');
      mockClient.disconnect = vi.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(service.disconnect()).rejects.toThrow('Disconnection failed');
    });
  });

  describe('operations', () => {
    beforeEach(async () => {
      // Initialize and connect
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(true);
      vi.mocked(AzguardClient.create).mockResolvedValue(mockClient);
      await service.initialize();
      
      mockClient.accounts = [TestUtils.createMockCaipAccount()];
      const dappMetadata = { name: 'Test Dapp' };
      const permissions = [{ chains: ['aztec:0'], methods: ['send_transaction'] }];
      await service.connect(dappMetadata, permissions);
    });

    it('sends transaction successfully', async () => {
      // Arrange
      const operation = {
        kind: 'send_transaction' as const,
        account: TestUtils.createMockCaipAccount(),
        actions: []
      };
      
      const mockResult = { status: 'ok', result: TEST_CONSTANTS.MOCK_TX_HASH };
      mockClient.execute = vi.fn().mockResolvedValue([mockResult]);

      // Act
      const txHash = await service.sendTransaction(operation);

      // Assert
      expect(mockClient.execute).toHaveBeenCalledWith([operation]);
      expect(txHash).toBe(TEST_CONSTANTS.MOCK_TX_HASH);
    });

    it('handles transaction errors', async () => {
      // Arrange
      const operation = {
        kind: 'send_transaction' as const,
        account: TestUtils.createMockCaipAccount(),
        actions: []
      };
      
      const mockResult = { status: 'error', error: 'Transaction failed' };
      mockClient.execute = vi.fn().mockResolvedValue([mockResult]);

      // Act & Assert
      await expect(service.sendTransaction(operation)).rejects.toThrow('Transaction failed');
    });

    it('simulates views successfully', async () => {
      // Arrange
      const operation = {
        kind: 'simulate_views' as const,
        account: TestUtils.createMockCaipAccount(),
        calls: []
      };
      
      const mockResult = { status: 'ok', result: { decoded: ['result1', 'result2'] } };
      mockClient.execute = vi.fn().mockResolvedValue([mockResult]);

      // Act
      const result = await service.simulateViews(operation);

      // Assert
      expect(mockClient.execute).toHaveBeenCalledWith([operation]);
      expect(result).toEqual({ decoded: ['result1', 'result2'] });
    });

    it('executes multiple operations in batch', async () => {
      // Arrange
      const operations = [
        { kind: 'send_transaction' as const, account: TestUtils.createMockCaipAccount(), actions: [] },
        { kind: 'simulate_views' as const, account: TestUtils.createMockCaipAccount(), calls: [] }
      ];
      
      const mockResults = [
        { status: 'ok', result: 'tx-hash' },
        { status: 'ok', result: 'view-result' }
      ];
      mockClient.execute = vi.fn().mockResolvedValue(mockResults);

      // Act
      const results = await service.executeOperations(operations);

      // Assert
      expect(mockClient.execute).toHaveBeenCalledWith(operations);
      expect(results).toEqual(mockResults);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      const { AzguardClient } = await import('@azguardwallet/client');
      vi.mocked(AzguardClient.isAzguardInstalled).mockResolvedValue(true);
      vi.mocked(AzguardClient.create).mockResolvedValue(mockClient);
      await service.initialize();
    });

    it('updates state when accounts change', () => {
      const accountsChangedHandler =
        mockClient.onAccountsChanged.addHandler.mock.calls[0][0];

      const accounts = [
        TestUtils.createMockCaipAccount(),
        TestUtils.createMockCaipAccount(
          'aztec:0',
          '0xabcdef1234567890abcdef1234567890abcdef12'
        ),
      ];

      accountsChangedHandler(accounts);

      const state = service.getState();
      expect(state.accounts).toEqual(accounts);
      expect(state.selectedAccount).toBe(accounts[0]);
      expect(state.isConnected).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('returns supported chains', () => {
      // Act
      const chains = service.getSupportedChains();

      // Assert
      expect(chains).toContain('aztec:0');
      expect(chains).toContain('aztec:11155111');
      expect(chains).toContain('aztec:1337');
    });

    it('returns current state', () => {
      // Act
      const state = service.getState();

      // Assert
      expect(state).toHaveProperty('isInstalled');
      expect(state).toHaveProperty('isConnected');
      expect(state).toHaveProperty('accounts');
      expect(state).toHaveProperty('selectedAccount');
    });

    it('cleans up resources on destroy', () => {
      // Act
      service.destroy();

      // Assert
      const state = service.getState();
      expect(state.isInstalled).toBe(false);
      expect(state.isConnected).toBe(false);
      expect(state.accounts).toEqual([]);
    });
  });
});
