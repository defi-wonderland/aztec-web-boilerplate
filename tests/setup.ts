/**
 * Test setup and configuration for Vitest
 */

import { afterEach, beforeEach, vi } from 'vitest';
import type { CaipAccount } from '@azguardwallet/types';

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
   * Create a mock CAIP account for testing
   */
  static createMockCaipAccount(chain = 'aztec:0', address?: string): CaipAccount {
    const mockAddress = address || TEST_CONSTANTS.MOCK_ADDRESS;
    return `${chain}:${mockAddress}` as CaipAccount;
  }
}

export const TEST_CONSTANTS = {
  MOCK_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678',
  MOCK_TX_HASH: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
} as const;
