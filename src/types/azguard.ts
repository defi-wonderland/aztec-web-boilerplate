import type { CaipAccount } from '@azguardwallet/types';

/**
 * Azguard wallet connection state
 */
export interface AzguardWalletState {
  isInstalled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  accounts: CaipAccount[];
  selectedAccount: CaipAccount | null;
  supportedChains: string[];
  error: string | null;
}
