import { type Address } from 'viem';

export interface EVMWalletState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  isDisconnected: boolean;
  error: Error | null;
}

export interface EVMAccount {
  address: Address;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  isDisconnected: boolean;
}

export interface EVMBalance {
  address: Address;
  balance: bigint;
  formatted: string;
  symbol: string;
  decimals: number;
}

export interface EVMNetworkState {
  chainId: number;
  isSupported: boolean;
  isWrongNetwork: boolean;
}
