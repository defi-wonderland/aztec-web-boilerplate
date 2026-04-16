import type { ConnectionStatus } from './walletConnector';
import type { DappMetadata } from '../config/dapp';
import type { CaipAccount } from '@azguardwallet/types';

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

/**
 * Permission request for Azguard connection
 */
export interface AzguardPermission {
  chains: string[];
  methods: string[];
}

/**
 * Configuration for connecting to Azguard wallet
 */
export interface AzguardConnectionConfig {
  dappMetadata: DappMetadata;
  requiredPermissions: AzguardPermission[];
  optionalPermissions?: AzguardPermission[];
}
