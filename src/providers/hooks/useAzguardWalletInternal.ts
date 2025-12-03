/**
 * Internal hook for Azguard wallet management
 * Used by UniversalWalletProvider - not for direct consumption
 */

import { useState, useEffect, useRef } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { AzguardClient } from '@azguardwallet/client';
import type {
  CaipAccount,
  Operation,
  OperationResult,
} from '@azguardwallet/types';
import type {
  AzguardWalletState,
  AzguardConnectionConfig,
} from '../../types/azguard';
import { AzguardWalletService } from '../../services/aztec/wallet/AzguardWalletService';
import { AzguardAccountAdapter } from '../../services/aztec/wallet/AzguardAccountAdapter';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { useError } from '../ErrorProvider';
import { useConfig } from '../../hooks/context/useConfig';
import {
  AZGUARD_CHAIN_IDS,
  type AzguardChainId,
} from '../../config/networks/constants';

const DEFAULT_AZGUARD_STATE: AzguardWalletState = {
  isInstalled: false,
  isConnected: false,
  isConnecting: false,
  accounts: [],
  selectedAccount: null,
  supportedChains: [],
  error: null,
};

/**
 * Azguard methods we request permission for
 */
const AZGUARD_METHODS = [
  'register_contract',
  'send_transaction',
  'simulate_views',
  'simulate_utility',
  'add_private_authwit',
  'call',
];

const buildAzguardConnectionConfig = (
  networkName: string
): AzguardConnectionConfig => {
  const isSandbox = networkName === 'sandbox';
  const requiredChain: AzguardChainId = isSandbox
    ? AZGUARD_CHAIN_IDS.sandbox
    : AZGUARD_CHAIN_IDS.testnet;

  return {
    dappMetadata: {
      name: 'Aztec Web Boilerplate',
      description: 'Privacy-first application built on Aztec Network',
      url: typeof window !== 'undefined' ? window.location.origin : '',
      icon:
        typeof window !== 'undefined'
          ? `${window.location.origin}/favicon.ico`
          : '',
    },
    requiredPermissions: [
      {
        chains: [requiredChain],
        methods: AZGUARD_METHODS,
      },
    ],
    // Only request permissions for the current network
    // Users can reconnect if they switch networks
  };
};

export interface AzguardWalletActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchAccount: (account: CaipAccount) => Promise<void>;
  executeOperations: (ops: Operation[]) => Promise<OperationResult[]>;
}

export interface UseAzguardWalletInternalReturn {
  state: AzguardWalletState;
  actions: AzguardWalletActions;
  client: AzguardClient | null;
  getAccountWallet: (account: CaipAccount) => Promise<AccountWithSecretKey>;
  isLoading: boolean;
  error: string | null;
}

export const useAzguardWalletInternal = (): UseAzguardWalletInternalReturn => {
  const [azguardState, setAzguardState] = useState<AzguardWalletState>(
    DEFAULT_AZGUARD_STATE
  );

  const azguardServiceRef = useRef<AzguardWalletService | null>(null);
  const accountAdapterRef = useRef<AzguardAccountAdapter | null>(null);
  const isInitializedRef = useRef(false);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { addMessage } = useError();
  const { currentConfig } = useConfig();

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initAzguard = async () => {
      try {
        const azguardService = new AzguardWalletService();
        const accountAdapter = new AzguardAccountAdapter(azguardService);

        azguardServiceRef.current = azguardService;
        accountAdapterRef.current = accountAdapter;

        await azguardService.initialize();
        setAzguardState(azguardService.getState());
        setupEventListeners(azguardService);

        console.log('✅ Azguard wallet service initialized');
      } catch (err) {
        console.error('❌ Failed to initialize Azguard wallet service:', err);
        setAzguardState((prev) => ({
          ...prev,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to initialize Azguard wallet',
        }));
      }
    };

    initAzguard();

    return () => {
      azguardServiceRef.current?.destroy();
      accountAdapterRef.current?.destroy();
    };
  }, []);

  const setupEventListeners = (service: AzguardWalletService) => {
    service.onAccountsChanged((accounts: CaipAccount[]) => {
      setAzguardState((prev) => ({
        ...prev,
        accounts,
        selectedAccount: accounts.length > 0 ? accounts[0] : null,
      }));
    });

    service.onDisconnected(() => {
      setAzguardState((prev) => ({
        ...prev,
        isConnected: false,
        accounts: [],
        selectedAccount: null,
      }));

      addMessage({
        message: 'Azguard wallet disconnected',
        type: 'info',
        source: 'azguard',
      });
    });
  };

  const handleConnect = async (): Promise<void> => {
    return executeAsync(async () => {
      if (!azguardServiceRef.current) {
        throw new Error('Azguard service not initialized');
      }

      const connectionConfig = buildAzguardConnectionConfig(currentConfig.name);

      const supportedChains = azguardServiceRef.current.getSupportedChains();
      console.log('🔗 Supported chains from Azguard:', supportedChains);
      console.log('🔧 Azguard connection config:', connectionConfig);

      const accounts = await azguardServiceRef.current.connect(
        connectionConfig.dappMetadata,
        connectionConfig.requiredPermissions,
        connectionConfig.optionalPermissions
      );

      setAzguardState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        accounts,
        selectedAccount: accounts.length > 0 ? accounts[0] : null,
        error: null,
      }));

      addMessage({
        message: `Connected to Azguard wallet with ${accounts.length} account(s)`,
        type: 'success',
        source: 'azguard',
      });

      console.log('✅ Connected to Azguard wallet:', accounts);
    }, 'connect to Azguard wallet');
  };

  const handleDisconnect = async (): Promise<void> => {
    return executeAsync(async () => {
      if (!azguardServiceRef.current) return;

      await azguardServiceRef.current.disconnect();

      setAzguardState((prev) => ({
        ...prev,
        isConnected: false,
        accounts: [],
        selectedAccount: null,
        error: null,
      }));

      addMessage({
        message: 'Disconnected from Azguard wallet',
        type: 'info',
        source: 'azguard',
      });

      console.log('✅ Disconnected from Azguard wallet');
    }, 'disconnect from Azguard wallet');
  };

  const handleSwitchAccount = async (
    newAccount: CaipAccount
  ): Promise<void> => {
    return executeAsync(async () => {
      if (!azguardState.accounts.includes(newAccount)) {
        throw new Error('Account not found in connected accounts');
      }

      setAzguardState((prev) => ({
        ...prev,
        selectedAccount: newAccount,
      }));

      console.log('✅ Switched to Azguard account:', newAccount);
    }, 'switch Azguard account');
  };

  const handleExecuteOperations = async (
    operations: Operation[]
  ): Promise<OperationResult[]> => {
    if (!azguardServiceRef.current) {
      throw new Error('Azguard service not initialized');
    }

    if (!azguardState.isConnected) {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const results =
        await azguardServiceRef.current.executeOperations(operations);
      
      const failedResults = results.filter(r => r.status === 'failed');
      if (failedResults.length > 0) {
        const errors = failedResults
          .map((r, i) => `Operation ${i}: ${'error' in r ? r.error : 'Unknown error'}`)
          .join('; ');
        console.error('❌ Some Azguard operations failed:', errors);
      } else {
        console.log('✅ All Azguard operations completed successfully');
      }
      
      return results;
    } catch (err) {
      console.error('❌ Failed to execute Azguard operations:', err);
      throw err;
    }
  };

  const getAccountWallet = async (
    account: CaipAccount
  ): Promise<AccountWithSecretKey> => {
    if (!accountAdapterRef.current) {
      throw new Error('Account adapter not initialized');
    }
    return accountAdapterRef.current.toAccountWallet(account);
  };

  return {
    state: azguardState,
    actions: {
      connect: handleConnect,
      disconnect: handleDisconnect,
      switchAccount: handleSwitchAccount,
      executeOperations: handleExecuteOperations,
    },
    client: azguardServiceRef.current?.getClient() ?? null,
    getAccountWallet,
    isLoading,
    error,
  };
};
