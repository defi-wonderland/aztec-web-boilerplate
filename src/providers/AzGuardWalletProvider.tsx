import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, cookieStorage, createStorage, WagmiProvider, useAccount, useBalance, useChainId, useConnect, useDisconnect } from 'wagmi';
import { DEFAULT_EVM_CHAIN, EVM_CHAINS } from '../config';
import { EVMAccount, EVMBalance, EVMNetworkState } from '../types';

// Create React Query client
const queryClient = new QueryClient();

// AzGuard Wallet integration
interface AzGuardWallet {
  isAzGuard?: boolean;
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    azguard?: AzGuardWallet;
    ethereum?: any;
  }
}

// Create custom connector for AzGuard
const azguardConnector = {
  id: 'azguard',
  name: 'AzGuard Wallet',
  type: 'injected' as const,
  async connect() {
    if (!window.azguard) {
      throw new Error('AzGuard Wallet not found. Please install AzGuard Wallet.');
    }

    try {
      const accounts = await window.azguard.request({
        method: 'eth_requestAccounts',
      });

      const chainId = await window.azguard.request({
        method: 'eth_chainId',
      });

      return {
        accounts,
        chainId: parseInt(chainId, 16),
      };
    } catch (error) {
      throw new Error('Failed to connect to AzGuard Wallet');
    }
  },

  async disconnect() {
    // AzGuard doesn't have a disconnect method, so we just clear the connection state
    return;
  },

  async getAccounts() {
    if (!window.azguard) return [];
    
    try {
      return await window.azguard.request({
        method: 'eth_accounts',
      });
    } catch {
      return [];
    }
  },

  async getChainId() {
    if (!window.azguard) return DEFAULT_EVM_CHAIN.id;
    
    try {
      const chainId = await window.azguard.request({
        method: 'eth_chainId',
      });
      return parseInt(chainId, 16);
    } catch {
      return DEFAULT_EVM_CHAIN.id;
    }
  },

  async isAuthorized() {
    try {
      const accounts = await this.getAccounts();
      return accounts.length > 0;
    } catch {
      return false;
    }
  },

  onAccountsChanged(handler: (accounts: string[]) => void) {
    if (window.azguard) {
      window.azguard.on('accountsChanged', handler);
    }
  },

  onChainChanged(handler: (chainId: string) => void) {
    if (window.azguard) {
      window.azguard.on('chainChanged', handler);
    }
  },

  onDisconnect(handler: () => void) {
    if (window.azguard) {
      window.azguard.on('disconnect', handler);
    }
  },
};

export const config = createConfig({
  chains: [DEFAULT_EVM_CHAIN],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [DEFAULT_EVM_CHAIN.id]: http(),
  },
  batch: { multicall: true },
  connectors: [], // We'll manage connection manually
});

export interface EVMWalletContextType {
  // Account state
  account: EVMAccount | null;
  network: EVMNetworkState;
  balance: EVMBalance | null;
  isBalanceLoading: boolean;
  
  // Connection state
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const EVMWalletContext = createContext<EVMWalletContextType | undefined>(undefined);

interface EVMWalletProviderProps {
  children: ReactNode;
}

// Inner provider component that manages AzGuard wallet state
const EVMWalletInnerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<EVMAccount | null>(null);
  const [balance, setBalance] = useState<EVMBalance | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number>(DEFAULT_EVM_CHAIN.id);

  // Check if AzGuard is available
  const isSupported = typeof window !== 'undefined' && !!window.azguard;
  
  console.log('AzGuard Provider - isSupported:', isSupported, 'window.azguard:', typeof window !== 'undefined' ? !!window.azguard : 'SSR');

  useEffect(() => {
    if (!isSupported) return;

    // Check if already connected
    checkConnection();

    // Set up event listeners
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount({
          address: accounts[0] as `0x${string}`,
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          isDisconnected: false,
        });
        loadBalance(accounts[0]);
      } else {
        setAccount(null);
        setBalance(null);
      }
    };

    const handleChainChanged = (newChainId: string) => {
      const id = parseInt(newChainId, 16);
      setChainId(id);
      // Reload balance when chain changes
      if (account) {
        loadBalance(account.address);
      }
    };

    const handleDisconnect = () => {
      setAccount(null);
      setBalance(null);
    };

    if (window.azguard) {
      azguardConnector.onAccountsChanged(handleAccountsChanged);
      azguardConnector.onChainChanged(handleChainChanged);
      azguardConnector.onDisconnect(handleDisconnect);
    }

    return () => {
      // Cleanup event listeners
      if (window.azguard) {
        window.azguard.off('accountsChanged', handleAccountsChanged);
        window.azguard.off('chainChanged', handleChainChanged);
        window.azguard.off('disconnect', handleDisconnect);
      }
    };
  }, [isSupported, account]);

  const checkConnection = async () => {
    if (!window.azguard) return;

    try {
      const accounts = await azguardConnector.getAccounts();
      const currentChainId = await azguardConnector.getChainId();
      
      setChainId(currentChainId);
      
      if (accounts.length > 0) {
        setAccount({
          address: accounts[0] as `0x${string}`,
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          isDisconnected: false,
        });
        loadBalance(accounts[0]);
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
    }
  };

  const loadBalance = async (address: string) => {
    if (!window.azguard) return;

    setIsBalanceLoading(true);
    try {
      const balanceHex = await window.azguard.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });

      const balanceWei = BigInt(balanceHex);
      const balanceEth = Number(balanceWei) / Math.pow(10, 18);

      setBalance({
        address: address as `0x${string}`,
        balance: balanceWei,
        formatted: balanceEth.toFixed(6),
        symbol: 'ETH',
        decimals: 18,
      });
    } catch (error) {
      console.error('Failed to load balance:', error);
      setBalance(null);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!isSupported) {
      throw new Error('AzGuard Wallet not found. Please install AzGuard Wallet.');
    }

    setIsConnecting(true);
    try {
      const result = await azguardConnector.connect();
      
      if (result.accounts.length > 0) {
        setAccount({
          address: result.accounts[0] as `0x${string}`,
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          isDisconnected: false,
        });
        setChainId(result.chainId);
        loadBalance(result.accounts[0]);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAccount(null);
    setBalance(null);
  };

  // Create network state
  const network: EVMNetworkState = {
    chainId,
    isSupported: EVM_CHAINS.some((chain) => chain.id === chainId),
    isWrongNetwork: !EVM_CHAINS.some((chain) => chain.id === chainId),
  };

  const contextValue: EVMWalletContextType = {
    account,
    network,
    balance,
    isBalanceLoading,
    isSupported,
    isConnected: !!account?.isConnected,
    isConnecting,
    connect: handleConnect,
    disconnect: handleDisconnect,
  };

  return (
    <EVMWalletContext.Provider value={contextValue}>
      {children}
    </EVMWalletContext.Provider>
  );
};

export const AzGuardWalletProvider: React.FC<EVMWalletProviderProps> = ({ children }) => {
  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <EVMWalletInnerProvider>{children}</EVMWalletInnerProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

