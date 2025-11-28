import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Operation, CaipAccount, CallAction } from '@azguardwallet/types';
import type { IAzguardAccountAdapter } from '../../../types/aztec';
import { AzguardWalletService } from './AzguardWalletService';

/**
 * Transaction request shape for Azguard conversion
 */
interface TxRequest {
  to?: string;
  method?: string;
  args?: unknown[];
}

/**
 * Adapter class that converts between Azguard CAIP accounts and Aztec AccountWallet
 */
export class AzguardAccountAdapter implements IAzguardAccountAdapter {
  private azguardService: AzguardWalletService;
  private accountWalletCache: Map<string, AccountWithSecretKey> = new Map();

  constructor(azguardService: AzguardWalletService) {
    this.azguardService = azguardService;
  }

  /**
   * Convert CAIP account to AccountWallet-compatible interface
   * Note: This creates a proxy that delegates operations to Azguard
   */
  async toAccountWallet(caipAccount: CaipAccount): Promise<AccountWithSecretKey> {
    // Check cache first
    if (this.accountWalletCache.has(caipAccount)) {
      return this.accountWalletCache.get(caipAccount)!;
    }

    try {
      // Extract address from CAIP account format (aztec:chainId:address)
      const address = this.getAztecAddress(caipAccount);
      
      // Create a proxy AccountWallet that delegates to Azguard
      const accountWallet = this.createAccountWalletProxy(caipAccount, address);
      
      // Cache the result
      this.accountWalletCache.set(caipAccount, accountWallet);
      
      return accountWallet;
    } catch (error) {
      console.error('Failed to convert CAIP account to AccountWallet:', error);
      throw new Error(`Failed to convert account ${caipAccount}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the Aztec address from CAIP account
   */
  getAztecAddress(caipAccount: CaipAccount): AztecAddress {
    try {
      // CAIP account format: aztec:chainId:address
      const parts = caipAccount.split(':');
      if (parts.length !== 3 || parts[0] !== 'aztec') {
        throw new Error(`Invalid CAIP account format: ${caipAccount}`);
      }

      const addressStr = parts[2];
      if (!addressStr.startsWith('0x')) {
        throw new Error(`Invalid address format: ${addressStr}`);
      }

      // Aztec addresses are 32 bytes (64 hex chars + 0x = 66 chars total)
      // Ethereum addresses are 20 bytes (40 hex chars + 0x = 42 chars total)
      if (addressStr.length === 66) {
        // This is already an Aztec address format
        return AztecAddress.fromString(addressStr);
      } else if (addressStr.length === 42) {
        // This is an Ethereum address format, need to convert to Aztec format
        // Pad with zeros to make it 32 bytes (Aztec address length)
        const paddedAddress = addressStr.replace('0x', '').padStart(64, '0');
        const aztecAddressStr = '0x' + paddedAddress;
        return AztecAddress.fromString(aztecAddressStr);
      } else {
        throw new Error(`Unsupported address length: ${addressStr.length}. Expected 42 (Ethereum) or 66 (Aztec) characters.`);
      }
    } catch (error) {
      console.error('Failed to extract Aztec address from CAIP account:', error);
      throw error;
    }
  }

  /**
   * Execute Azguard-specific operations
   */
  async executeOperation(operation: Operation): Promise<unknown> {
    try {
      const results = await this.azguardService.executeOperations([operation]);
      
      if (results.length === 0) {
        throw new Error('No results returned from operation');
      }

      const result = results[0];
      if (result.status !== 'ok') {
        // Handle failed or skipped results
        const errorMessage = 'error' in result ? result.error : 'Operation failed or was skipped';
        throw new Error(errorMessage || 'Operation failed');
      }

      return result.result;
    } catch (error) {
      console.error('❌ Failed to execute operation:', error);
      throw error;
    }
  }

  /**
   * Check if account is deployed on the network
   */
  async isAccountDeployed(caipAccount: CaipAccount): Promise<boolean> {
    try {
      // This would typically involve calling a view function or checking account state
      // For now, we'll implement a basic check
      const address = this.getAztecAddress(caipAccount);
      
      // TODO: Implement actual deployment check via Azguard
      // This might involve calling a specific operation or view function
      console.log(`Checking deployment status for account: ${address.toString()}`);
      
      // Placeholder implementation - in reality, this would check the account's deployment status
      return false;
    } catch (error) {
      console.error('❌ Failed to check account deployment status:', error);
      return false;
    }
  }

  /**
   * Create a proxy AccountWallet that delegates operations to Azguard
   */
  private createAccountWalletProxy(caipAccount: CaipAccount, address: AztecAddress): AccountWithSecretKey {
    // This is a complex implementation that would need to proxy all AccountWallet methods
    // For now, we'll create a minimal implementation that covers the most important methods
    
    const proxy = {
      // Basic account information
      getAddress: () => address,
      
      // Transaction methods - these would delegate to Azguard
      sendTransaction: async (txRequest: unknown) => {
        // Convert Aztec transaction request to Azguard operation
        const operation = this.convertToAzguardOperation(txRequest as TxRequest, caipAccount);
        return this.executeOperation(operation);
      },
      
      // View methods
      simulateCall: async (callRequest: unknown) => {
        // Convert to simulate_views operation
        const callAction = callRequest as CallAction;
        const operation: Operation = {
          kind: 'simulate_views' as const,
          account: caipAccount,
          calls: [callAction]
        };
        return this.executeOperation(operation);
      },
      
      // Other required methods would be implemented here
      // This is a simplified version for demonstration
      
    } as unknown as AccountWithSecretKey;

    return proxy;
  }

  /**
   * Convert Aztec transaction request to Azguard operation
   */
  private convertToAzguardOperation(txRequest: TxRequest, account: CaipAccount): Operation {
    // This is a simplified conversion - the actual implementation would need
    // to handle all the different types of Aztec transactions and convert them
    // to appropriate Azguard operations
    
    const callAction: CallAction = {
      kind: 'call',
      contract: txRequest.to ?? '0x0000000000000000000000000000000000000000000000000000000000000000',
      method: txRequest.method ?? 'unknown',
      args: (txRequest.args ?? []) as string[]
    };
    
    return {
      kind: 'send_transaction',
      account,
      actions: [callAction]
    };
  }

  /**
   * Clear the account wallet cache
   */
  clearCache(): void {
    this.accountWalletCache.clear();
  }

  /**
   * Get cached account wallet if available
   */
  getCachedAccountWallet(caipAccount: CaipAccount): AccountWithSecretKey | null {
    return this.accountWalletCache.get(caipAccount) || null;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.accountWalletCache.clear();
  }
}
