/**
 * useBrowserWallet - Hook for Browser Wallet management
 *
 * Manages wallets with external PXE (browser extensions like Azguard, Obsidian, etc.)
 * The extension manages both signing and PXE - we communicate via the adapter interface.
 *
 * This hook is wallet-agnostic. Wallet-specific logic lives in adapters
 * that implement IBrowserWalletAdapter.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type {
  IBrowserWalletAdapter,
  BrowserWalletState,
  BrowserWalletOperation,
  BrowserWalletOperationResult,
} from '../../types/browserWallet';
import { DEFAULT_BROWSER_WALLET_STATE } from '../../types/browserWallet';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { useError } from '../ErrorProvider';
import { buildRegisterContractOperations } from '../../utils/browserWallet';
import type { NetworkConfig } from '../../config/networks';
import type { AztecChainId } from '../../config/networks/constants';

export interface BrowserWalletActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  executeOperations: (ops: BrowserWalletOperation[]) => Promise<BrowserWalletOperationResult[]>;
}

export interface UseBrowserWalletReturn {
  state: BrowserWalletState;
  actions: BrowserWalletActions;
  accountWallet: AccountWithSecretKey | null;
  isLoading: boolean;
  error: string | null;
}

interface UseBrowserWalletOptions {
  config: NetworkConfig;
  adapter: IBrowserWalletAdapter | null;
}

/**
 * Hook for managing Browser Wallets via adapter pattern.
 * Wallet-specific logic is delegated to the provided adapter.
 * If no adapter is provided, returns a no-op state.
 */
export const useBrowserWallet = (
  options: UseBrowserWalletOptions
): UseBrowserWalletReturn => {
  const { config: currentConfig, adapter } = options;

  const [walletState, setWalletState] = useState<BrowserWalletState>(
    DEFAULT_BROWSER_WALLET_STATE
  );
  const [accountWallet, setAccountWallet] = useState<AccountWithSecretKey | null>(null);

  const isInitializedRef = useRef(false);
  const contractRegistrationRef = useRef<string | null>(null);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { addMessage } = useError();

  useEffect(() => {
    if (!adapter || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initWallet = async () => {
      try {
        await adapter.initialize();
        setWalletState(adapter.getState());

        adapter.onAccountsChanged((accounts) => {
          setWalletState((prev) => ({
            ...prev,
            accounts,
            selectedAccount: accounts.length > 0 ? accounts[0] : null,
          }));
        });

        adapter.onDisconnected(() => {
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

        console.log(`✅ ${adapter.label} initialized`);
      } catch (err) {
        console.error(`❌ Failed to initialize ${adapter.label}:`, err);
        setWalletState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to initialize browser wallet',
        }));
      }
    };

    initWallet();

    return () => {
      adapter.destroy();
    };
  }, [adapter, addMessage]);

  // Auto-register contracts when connected
  useEffect(() => {
    if (!adapter || !walletState.isConnected || !walletState.selectedAccount) {
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
        const results = await adapter.executeOperations(operations);

        const succeeded = results.filter((r) => r.status === 'ok').length;
        const failed = results.filter((r) => r.status === 'failed').length;

        if (failed > 0) {
          console.warn(`⚠️ Contract registration: ${succeeded}/${operations.length} succeeded`);
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
  }, [walletState.isConnected, walletState.selectedAccount, currentConfig, adapter]);

  // Auto-fetch account wallet when selected account changes
  useEffect(() => {
    if (!adapter || !walletState.isConnected || !walletState.selectedAccount) {
      setAccountWallet(null);
      return;
    }

    let isActive = true;

    const fetchAccountWallet = async () => {
      try {
        const wallet = await adapter.toAccountWallet(walletState.selectedAccount!);
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
  }, [walletState.isConnected, walletState.selectedAccount, adapter]);

  const handleConnect = useCallback(async (): Promise<void> => {
    if (!adapter) {
      throw new Error('No browser wallet adapter configured');
    }
    return executeAsync(async () => {
      const accounts = await adapter.connect(currentConfig.name);

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

      console.log(`✅ ${adapter.label} connected:`, accounts);
    }, `connect to ${adapter.label}`);
  }, [currentConfig.name, executeAsync, addMessage, adapter]);

  const handleDisconnect = useCallback(async (): Promise<void> => {
    if (!adapter) return;
    return executeAsync(async () => {
      await adapter.disconnect();

      setWalletState((prev) => ({
        ...prev,
        isConnected: false,
        accounts: [],
        selectedAccount: null,
        error: null,
      }));

      addMessage({
        message: `Disconnected from ${adapter.label}`,
        type: 'info',
        source: 'wallet',
      });

      console.log(`✅ ${adapter.label} disconnected`);
    }, `disconnect from ${adapter.label}`);
  }, [executeAsync, addMessage, adapter]);

  const handleExecuteOperations = useCallback(
    async (operations: BrowserWalletOperation[]): Promise<BrowserWalletOperationResult[]> => {
      if (!adapter) {
        throw new Error('No browser wallet adapter configured');
      }
      const results = await adapter.executeOperations(operations);

      const failedResults = results.filter((r) => r.status === 'failed');
      if (failedResults.length > 0) {
        console.error('❌ Some operations failed');
      }

      return results;
    },
    [adapter]
  );

  const actions = useMemo(
    () => ({
      connect: handleConnect,
      disconnect: handleDisconnect,
      executeOperations: handleExecuteOperations,
    }),
    [handleConnect, handleDisconnect, handleExecuteOperations]
  );

  return {
    state: walletState,
    actions,
    accountWallet,
    isLoading,
    error,
  };
};
