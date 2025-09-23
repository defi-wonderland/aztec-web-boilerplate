/**
 * Test setup and configuration for Vitest
 * This file contains common test utilities and setup for all test files
 */

import { vi } from 'vitest';

// Re-export commonly used testing utilities
export * from '../src/types';

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

// Global test teardown
afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});

// Test utilities and helpers
export class TestUtils {
  /**
   * Create a mock CAIP account for testing
   */
  static createMockCaipAccount(chain = 'aztec:31337', address?: string): any {
    const mockAddress = address || '0x1234567890abcdef1234567890abcdef12345678';
    return `${chain}:${mockAddress}` as any;
  }

  /**
   * Create a mock Azguard wallet state for testing
   */
  static createMockAzguardState(overrides: Partial<any> = {}): any {
    return {
      isInstalled: false,
      isConnected: false,
      isConnecting: false,
      accounts: [],
      selectedAccount: null,
      supportedChains: ['aztec:31337'],
      error: null,
      ...overrides
    };
  }

  /**
   * Create a mock connection config for testing
   */
  static createMockConnectionConfig(overrides: Partial<any> = {}): any {
    return {
      dappMetadata: {
        name: 'Test Dapp',
        description: 'Test description',
        url: 'https://test.com',
        icon: 'https://test.com/icon.png'
      },
      permissions: [
        {
          chains: ['aztec:31337'],
          methods: ['send_transaction', 'simulate_views']
        }
      ],
      ...overrides
    };
  }

  /**
   * Delay execution for testing async operations
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a mock error for testing error handling
   */
  static createMockError(message: string, code?: string): Error & { code?: string } {
    const error = new Error(message) as Error & { code?: string };
    if (code) {
      error.code = code;
    }
    return error;
  }
}

// Common test constants
export const TEST_CONSTANTS = {
  MOCK_CHAIN_ID: 'aztec:31337',
  MOCK_TESTNET_CHAIN_ID: 'aztec:11155111',
  MOCK_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678',
  MOCK_TX_HASH: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  MOCK_NODE_URL: 'http://localhost:8080'
} as const;
