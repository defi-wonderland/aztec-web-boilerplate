/**
 * Unit tests for Azguard type definitions
 * Verifies that Azguard types are properly imported and type-safe
 */

import type {
  AzguardWalletState,
  AzguardWalletContextType,
  AzguardConnectionConfig,
  CaipAccount,
  Operation,
  SendTransactionOperation
} from '../../../src/types/azguard';

import { WalletType } from '../../../src/types/aztec';
import { TestUtils, TEST_CONSTANTS } from '../../setup';
import { describe, it, expect } from 'vitest';

/**
 * Test suite for Azguard type definitions
 */
describe('Azguard Types', () => {
  describe('AzguardWalletState', () => {
    it('creates valid wallet state with default values', () => {
      const state: AzguardWalletState = TestUtils.createMockAzguardState();
      
      expect(typeof state).toBe('object');
      expect(state.isInstalled).toBe(false);
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(Array.isArray(state.accounts)).toBe(true);
      expect(state.selectedAccount).toBeNull();
      expect(Array.isArray(state.supportedChains)).toBe(true);
      expect(state.error).toBeNull();
    });

    it('accepts override values', () => {
      const state: AzguardWalletState = TestUtils.createMockAzguardState({
        isInstalled: true,
        isConnected: true,
        accounts: [TestUtils.createMockCaipAccount()]
      });

      expect(state.isInstalled).toBe(true);
      expect(state.isConnected).toBe(true);
      expect(state.accounts).toHaveLength(1);
    });
  });

  describe('AzguardConnectionConfig', () => {
    it('creates valid connection config', () => {
      const config: AzguardConnectionConfig = TestUtils.createMockConnectionConfig();
      
      expect(typeof config).toBe('object');
      expect(config.dappMetadata).toBeDefined();
      expect(config.dappMetadata.name).toBe('Test Dapp');
      expect(Array.isArray(config.permissions)).toBe(true);
      expect(config.permissions[0].chains).toContain(TEST_CONSTANTS.MOCK_CHAIN_ID);
    });

    it('accepts custom metadata', () => {
      const customConfig: AzguardConnectionConfig = TestUtils.createMockConnectionConfig({
        dappMetadata: {
          name: 'Custom Dapp',
          description: 'Custom description'
        }
      });

      expect(customConfig.dappMetadata.name).toBe('Custom Dapp');
      expect(customConfig.dappMetadata.description).toBe('Custom description');
    });
  });

  describe('CaipAccount', () => {
    it('creates valid CAIP account format', () => {
      const account: CaipAccount = TestUtils.createMockCaipAccount();
      
      expect(typeof account).toBe('string');
      expect(account).toMatch(/^aztec:\d+:0x[a-fA-F0-9]{40}$/);
      expect(account).toContain(TEST_CONSTANTS.MOCK_CHAIN_ID);
    });

    it('creates account with custom chain and address', () => {
      const customAccount: CaipAccount = TestUtils.createMockCaipAccount(
        TEST_CONSTANTS.MOCK_TESTNET_CHAIN_ID,
        '0xabcdef1234567890abcdef1234567890abcdef12'
      );

      expect(customAccount).toContain(TEST_CONSTANTS.MOCK_TESTNET_CHAIN_ID);
      expect(customAccount).toContain('0xabcdef1234567890abcdef1234567890abcdef12');
    });
  });

  describe('WalletType enum', () => {
    it('includes AZGUARD wallet type', () => {
      expect(WalletType.AZGUARD).toBe('azguard');
    });

    it('includes all expected wallet types', () => {
      expect(WalletType.EMBEDDED).toBe('embedded');
      expect(WalletType.AZGUARD).toBe('azguard');
      expect(WalletType.TEST).toBe('test');
    });
  });

  describe('SendTransactionOperation', () => {
    it('creates valid operation structure', () => {
      const account: CaipAccount = TestUtils.createMockCaipAccount();
      const operation: Partial<SendTransactionOperation> = {
        kind: 'send_transaction',
        account
      };

      expect(operation.kind).toBe('send_transaction');
      expect(operation.account).toBe(account);
    });
  });
});

/**
 * Type compilation verification
 * This function ensures all types can be instantiated without runtime errors
 */
export function verifyAzguardTypesCompile(): boolean {
  try {
    const state: AzguardWalletState = TestUtils.createMockAzguardState();
    const config: AzguardConnectionConfig = TestUtils.createMockConnectionConfig();
    const account: CaipAccount = TestUtils.createMockCaipAccount();
    const walletType: WalletType = WalletType.AZGUARD;

    return (
      typeof state === 'object' &&
      typeof config === 'object' &&
      typeof account === 'string' &&
      walletType === WalletType.AZGUARD
    );
  } catch (error) {
    console.error('Type compilation verification failed:', error);
    return false;
  }
}
