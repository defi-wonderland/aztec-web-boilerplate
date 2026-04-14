/**
 * Test setup and configuration for Vitest
 */

import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Test utilities for creating mock data
 */
export class TestUtils {
  /**
   * Create a mock address for testing
   */
  static createMockAddress(address?: string): string {
    return address || TEST_CONSTANTS.MOCK_ADDRESS;
  }
}

export const TEST_CONSTANTS = {
  MOCK_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678',
  MOCK_TX_HASH:
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
} as const;
