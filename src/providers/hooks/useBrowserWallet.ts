/**
 * useBrowserWallet - Hook for Browser Wallet management
 *
 * Manages wallets with external PXE (browser extension like Azguard).
 * The extension manages both signing and PXE - we just communicate via CAIP.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import {
  getChainId,
  type AztecChainId,
} from '../../config/networks/constants';
import { buildRegisterContractOperations } from '../../utils/azguard';
import type { NetworkConfig } from '../../config/networks';

const DEFAULT_BROWSER_WALLET_STATE: AzguardWalletState = {
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
  'aztec_getTxReceipt',
];

const buildConnectionConfig = (networkName: string): AzguardConnectionConfig => {
  const requiredChain: AztecChainId = getChainId(networkName);

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
  };
};

export interface BrowserWalletActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchAccount: (account: CaipAccount) => Promise<void>;
  executeOperations: (ops: Operation[]) => Promise<OperationResult[]>;
}

export interface UseBrowserWalletReturn {
  state: AzguardWalletState;
  actions: BrowserWalletActions;
  client: AzguardClient | null;
  accountWallet: AccountWithSecretKey | null;
  isLoading: boolean;
  error: string | null;
}

interface UseBrowserWalletOptions {
  config: NetworkConfig;
}

/**
 * Hook for managing Browser Wallets (Azguard, etc.)
 *
 * These wallets have their own PXE running in the extension.
 * We communicate via CAIP protocol.
 */
export const useBrowserWallet = (
  options: UseBrowserWalletOptions
): UseBrowserWalletReturn => {
  const { config: currentConfig } = options;

  const [walletState, setWalletState] = useState<AzguardWalletState>(
    DEFAULT_BROWSER_WALLET_STATE
  );
  const [accountWallet, setAccountWallet] = useState<AccountWithSecretKey | null>(null);

  const walletServiceRef = useRef<AzguardWalletService | null>(null);
  const accountAdapterRef = useRef<AzguardAccountAdapter | null>(null);
  const isInitializedRef = useRef(false);
  const contractRegistrationRef = useRef<string | null>(null);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { addMessage } = useError();

  // Initialize wallet service
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initWallet = async () => {
      try {
        const walletService = new AzguardWalletService();
        const accountAdapter = new AzguardAccountAdapter(walletService);

        walletServiceRef.current = walletService;
        accountAdapterRef.current = accountAdapter;

        await walletService.initialize();
        setWalletState(walletService.getState());
        setupEventListeners(walletService);

        console.log('✅ Browser wallet service initialized');
      } catch (err) {
        console.error('❌ Failed to initialize browser wallet service:', err);
        setWalletState((prev) => ({
          ...prev,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to initialize browser wallet',
        }));
      }
    };

    initWallet();

    return () => {
      walletServiceRef.current?.destroy();
      accountAdapterRef.current?.destroy();
    };
  }, []);

  const setupEventListeners = (service: AzguardWalletService) => {
    service.onAccountsChanged((accounts: CaipAccount[]) => {
      setWalletState((prev) => ({
        ...prev,
        accounts,
        selectedAccount: accounts.length > 0 ? accounts[0] : null,
      }));
    });

    service.onDisconnected(() => {
      setWalletState((prev) => ({
        ...prev,
        isConnected: false,
        accounts: [],
        selectedAccount: null,
      }));

      addMessage({
        message: 'Browser wallet disconnected',
        type: 'info',
        source: 'wallet',
      });
    });
  };

  // Auto-register contracts when connected
  useEffect(() => {
    if (!walletState.isConnected || !walletState.selectedAccount) {
      contractRegistrationRef.current = null;
      return;
    }

    const registrationKey = `${currentConfig.name}:${walletState.selectedAccount}`;
    if (contractRegistrationRef.current === registrationKey) {
      return;
    }

    let isActive = true;

    const registerContracts = async () => {
      try {
        const chainFromAccount =
          `${walletState.selectedAccount!.split(':').slice(0, 2).join(':')}` as AztecChainId;

        const operations = await buildRegisterContractOperations(
          currentConfig,
          chainFromAccount
        );

        if (!isActive || operations.length === 0) return;

        console.log(`📝 Registering ${operations.length} contracts...`);
        const results =
          (await walletServiceRef.current?.executeOperations(operations)) ?? [];

        const succeeded = results.filter((r) => r.status === 'ok').length;
        const failed = results.filter((r) => r.status === 'failed').length;

        if (failed > 0) {
          console.warn(
            `⚠️ Contract registration: ${succeeded}/${operations.length} succeeded`
          );
        } else {
          console.log(`✅ All ${succeeded} contracts registered`);
        }

        if (isActive) {
          contractRegistrationRef.current = registrationKey;
        }
      } catch (err) {
        console.error('❌ Failed to register contracts:', err);
      }
    };

    registerContracts();

    return () => {
      isActive = false;
    };
  }, [walletState.isConnected, walletState.selectedAccount, currentConfig]);

  // Auto-fetch account wallet when selected account changes
  useEffect(() => {
    if (!walletState.isConnected || !walletState.selectedAccount) {
      setAccountWallet(null);
      return;
    }

    let isActive = true;

    const fetchAccountWallet = async () => {
      try {
        if (!accountAdapterRef.current) return;
        const wallet = await accountAdapterRef.current.toAccountWallet(
          walletState.selectedAccount!
        );
        if (isActive) {
          setAccountWallet(wallet);
        }
      } catch (err) {
        console.error('Failed to get AccountWallet:', err);
        if (isActive) {
          setAccountWallet(null);
        }
      }
    };

    fetchAccountWallet();

    return () => {
      isActive = false;
    };
  }, [walletState.isConnected, walletState.selectedAccount]);

  const handleConnect = useCallback(async (): Promise<void> => {
    return executeAsync(async () => {
      if (!walletServiceRef.current) {
        throw new Error('Browser wallet service not initialized');
      }

      const connectionConfig = buildConnectionConfig(currentConfig.name);

      const accounts = await walletServiceRef.current.connect(
        connectionConfig.dappMetadata,
        connectionConfig.requiredPermissions,
        connectionConfig.optionalPermissions
      );

      setWalletState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        accounts,
        selectedAccount: accounts.length > 0 ? accounts[0] : null,
        error: null,
      }));

      addMessage({
        message: `Connected with ${accounts.length} account(s)`,
        type: 'success',
        source: 'wallet',
      });

      console.log('✅ Browser wallet connected:', accounts);
    }, 'connect to browser wallet');
  }, [currentConfig.name, executeAsync, addMessage]);

  const handleDisconnect = useCallback(async (): Promise<void> => {
    return executeAsync(async () => {
      if (!walletServiceRef.current) return;

      await walletServiceRef.current.disconnect();

      setWalletState((prev) => ({
        ...prev,
        isConnected: false,
        accounts: [],
        selectedAccount: null,
        error: null,
      }));

      addMessage({
        message: 'Disconnected from browser wallet',
        type: 'info',
        source: 'wallet',
      });

      console.log('✅ Browser wallet disconnected');
    }, 'disconnect from browser wallet');
  }, [executeAsync, addMessage]);

  const handleSwitchAccount = useCallback(
    async (newAccount: CaipAccount): Promise<void> => {
      return executeAsync(async () => {
        setWalletState((prev) => {
          if (!prev.accounts.includes(newAccount)) {
            throw new Error('Account not found');
          }
          return {
            ...prev,
            selectedAccount: newAccount,
          };
        });

        console.log('✅ Switched account:', newAccount);
      }, 'switch account');
    },
    [executeAsync]
  );

  const handleExecuteOperations = useCallback(
    async (operations: Operation[]): Promise<OperationResult[]> => {
      if (!walletServiceRef.current) {
        throw new Error('Browser wallet service not initialized');
      }

      const results = await walletServiceRef.current.executeOperations(operations);

      const failedResults = results.filter((r) => r.status === 'failed');
      if (failedResults.length > 0) {
        console.error('❌ Some operations failed');
      }

      return results;
    },
    []
  );

  const actions = useMemo(
    () => ({
      connect: handleConnect,
      disconnect: handleDisconnect,
      switchAccount: handleSwitchAccount,
      executeOperations: handleExecuteOperations,
    }),
    [handleConnect, handleDisconnect, handleSwitchAccount, handleExecuteOperations]
  );

  return {
    state: walletState,
    actions,
    client: walletServiceRef.current?.getClient() ?? null,
    accountWallet,
    isLoading,
    error,
  };
};
