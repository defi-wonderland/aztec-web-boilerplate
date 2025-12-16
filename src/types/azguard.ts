import type { CaipAccount } from '@azguardwallet/types';
import type { ConnectionStatus } from './walletConnector';

/**
 * Azguard wallet connection state
 */
export interface AzguardWalletState {
  isInstalled: boolean;
  status: ConnectionStatus;
  accounts: CaipAccount[];
  selectedAccount: CaipAccount | null;
  supportedChains: string[];
  error: string | null;
}
