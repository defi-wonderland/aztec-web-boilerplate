/**
 * Universal Wallet Provider
 * Consolidated provider that manages both embedded and Azguard wallets
 */

import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import type { AzguardClient } from '@azguardwallet/client';
import type {
  CaipAccount,
  Operation,
  OperationResult,
} from '@azguardwallet/types';
import type {
  AzguardWalletState,
  AzguardConnectionConfig,
} from '../types/azguard';
import { WalletType } from '../types/aztec';
import { AzguardWalletService } from '../services/aztec/wallet/AzguardWalletService';
import { AzguardAccountAdapter } from '../services/aztec/wallet/AzguardAccountAdapter';
import {
  initializeWalletServices,
  WalletServices,
  createAccount,
  connectTestAccount,
  connectExistingAccount,
} from '../services/aztec/wallet';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { useConfig } from '../hooks/context/useConfig';
import { useError } from './ErrorProvider';
import { DEFAULT_NETWORK } from '../config/networks';
import { isValidConfig } from '../utils';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface EmbeddedWalletActions {
  create: () => Promise<AccountWithSecretKey>;
  connectTest: (index: number) => Promise<AccountWithSecretKey>;
  connectExisting: () => Promise<AccountWithSecretKey | null>;
  isDeploying: boolean;
  forceShowSelector: () => void;
}

interface AzguardWalletActions {
  connect: () => Promise<void>;
  switchAccount: (account: CaipAccount) => Promise<void>;
  executeOperations: (ops: Operation[]) => Promise<OperationResult[]>;
  state: AzguardWalletState;
  client: AzguardClient | null;
}

export interface UniversalWalletContextType {
  // Unified state
  isConnected: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  walletType: WalletType | null;
  account: AccountWithSecretKey | null;

  // Services
  pxe: PXE | null;
  wallet: Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;

  // Universal actions
  disconnect: () => Promise<void>;
  reinitialize: () => Promise<void>;

  // Embedded-specific (namespaced)
  embedded: EmbeddedWalletActions;

  // Azguard-specific (namespaced)
  azguard: AzguardWalletActions;
}

export const UniversalWalletContext = createContext<
  UniversalWalletContextType | undefined
>(undefined);

interface UniversalWalletProviderProps {
  children: ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT AZGUARD STATE
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_AZGUARD_STATE: AzguardWalletState = {
  isInstalled: false,
  isConnected: false,
  isConnecting: false,
  accounts: [],
  selectedAccount: null,
  supportedChains: [],
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const UniversalWalletProvider: React.FC<UniversalWalletProviderProps> = ({
  children,
}) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Unified State
  // ─────────────────────────────────────────────────────────────────────────
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [account, setAccount] = useState<AccountWithSecretKey | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Embedded Wallet State
  // ─────────────────────────────────────────────────────────────────────────
  const [embeddedAccount, setEmbeddedAccount] =
    useState<AccountWithSecretKey | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [forceWalletSelector, setForceWalletSelector] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Azguard Wallet State
  // ─────────────────────────────────────────────────────────────────────────
  const [azguardState, setAzguardState] =
    useState<AzguardWalletState>(DEFAULT_AZGUARD_STATE);

  // ─────────────────────────────────────────────────────────────────────────
  // Service Refs
  // ─────────────────────────────────────────────────────────────────────────
  const walletServicesRef = useRef<WalletServices | null>(null);
  const azguardServiceRef = useRef<AzguardWalletService | null>(null);
  const accountAdapterRef = useRef<AzguardAccountAdapter | null>(null);
  const isInitializingRef = useRef(false);
  const azguardInitializedRef = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Hooks
  // ─────────────────────────────────────────────────────────────────────────
  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { currentConfig: config, resetToDefault } = useConfig();
  const { addMessage } = useError();

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Initialize Azguard services (once on mount)
  useEffect(() => {
    if (azguardInitializedRef.current) return;
    azguardInitializedRef.current = true;

    const initAzguard = async () => {
      try {
        const azguardService = new AzguardWalletService();
        const accountAdapter = new AzguardAccountAdapter(azguardService);

        azguardServiceRef.current = azguardService;
        accountAdapterRef.current = accountAdapter;

        await azguardService.initialize();
        setAzguardState(azguardService.getState());
        setupAzguardEventListeners(azguardService);

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

  // Initialize embedded wallet services (on config change)
  useEffect(() => {
    if (isInitializingRef.current) {
      console.log('🔄 Initialization already in progress, skipping');
      return;
    }

    if (!isValidConfig(config)) {
      console.warn(
        '⚠️ Network not ready, switching to default network:',
        config.name
      );

      if (config.name !== DEFAULT_NETWORK.name) {
        console.log('🔄 Switching to default network due to bad configuration');
        resetToDefault();
        return;
      }

      console.error('❌ Default network is not ready - this should not happen');
      return;
    }

    if (isInitialized) {
      handleNetworkSwitch();
    }

    handleAutoInitialize();
  }, [config]);

  // ─────────────────────────────────────────────────────────────────────────
  // Update active wallet based on connection states
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const updateActiveWallet = async () => {
      if (azguardState.isConnected && azguardState.selectedAccount) {
        try {
          if (!accountAdapterRef.current) return;
          const azguardAccountWallet = await accountAdapterRef.current.toAccountWallet(
            azguardState.selectedAccount
          );
          setWalletType(WalletType.AZGUARD);
          setAccount(azguardAccountWallet);
        } catch (err) {
          console.error('Failed to get Azguard AccountWallet:', err);
          setWalletType(null);
          setAccount(null);
        }
      } else if (embeddedAccount) {
        setWalletType(WalletType.EMBEDDED);
        setAccount(embeddedAccount);
      } else {
        setWalletType(null);
        setAccount(null);
      }
    };

    updateActiveWallet();
  }, [embeddedAccount, azguardState.isConnected, azguardState.selectedAccount]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const setupAzguardEventListeners = (service: AzguardWalletService) => {
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

  const handleNetworkSwitch = () => {
    setEmbeddedAccount(null);
    setIsInitialized(false);
    setForceWalletSelector(false);
    isInitializingRef.current = false;
  };

  const handleAutoInitialize = async () => {
    try {
      isInitializingRef.current = true;

      await executeAsync(async () => {
        const services = await initializeWalletServices(config.nodeUrl);
        walletServicesRef.current = services;
        setIsInitialized(true);

        // Auto-reconnect if account exists in localStorage
        const savedAccount = services.storageService.getAccount();
        if (savedAccount) {
          console.log('🔄 Found saved account, auto-reconnecting...');
          try {
            const wallet = await connectExistingAccount(
              services,
              setIsDeploying,
              addMessage,
              config
            );
            if (wallet) {
              setEmbeddedAccount(wallet);
              console.log(
                '✅ Auto-reconnected to saved account:',
                wallet.getAddress().toString()
              );
            }
          } catch (reconnectError) {
            console.warn(
              '⚠️ Failed to auto-reconnect, clearing saved account:',
              reconnectError
            );
            services.storageService.clearAccount();
          }
        }
      }, 'initialize wallet services');
    } catch (err) {
      console.error('App initialization failed:', err);
    } finally {
      isInitializingRef.current = false;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDED WALLET ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCreateAccount = async (): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await createAccount(
        walletServicesRef.current,
        setIsDeploying,
        addMessage,
        config
      );
      setEmbeddedAccount(wallet);
      return wallet;
    }, 'create account');
  };

  const handleConnectTestAccount = async (
    index: number
  ): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectTestAccount(
        walletServicesRef.current.walletService,
        index
      );
      setEmbeddedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (): Promise<AccountWithSecretKey | null> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectExistingAccount(
        walletServicesRef.current,
        setIsDeploying,
        addMessage,
        config
      );
      if (wallet) {
        setEmbeddedAccount(wallet);
      }
      return wallet;
    }, 'connect existing account');
  };

  const disconnectEmbedded = () => {
    setEmbeddedAccount(null);
    setIsDeploying(false);
    walletServicesRef.current?.storageService.clearAccount();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AZGUARD WALLET ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAzguardConnect = async (): Promise<void> => {
    return executeAsync(async () => {
      if (!azguardServiceRef.current) {
        throw new Error('Azguard service not initialized');
      }

      const supportedChains = azguardServiceRef.current.getSupportedChains();
      console.log('🔗 Supported chains from Azguard:', supportedChains);

      const connectionConfig: AzguardConnectionConfig = {
        dappMetadata: {
          name: 'Aztec Bridge and Seek',
          description:
            'Privacy-first cross-chain bridge application built on Aztec Network',
          url: window.location.origin,
          icon: `${window.location.origin}/favicon.ico`,
        },
        permissions: [
          {
            chains: ['aztec:11155111'],
            methods: [
              'register_contract',
              'send_transaction',
              'simulate_views',
              'add_private_authwit',
              'call',
            ],
          },
        ],
      };

      console.log('🔧 Azguard connection config:', connectionConfig);

      let accounts: CaipAccount[] = [];
      let connectionSuccessful = false;

      try {
        accounts = await azguardServiceRef.current.connect(
          connectionConfig.dappMetadata,
          connectionConfig.permissions
        );
        connectionSuccessful = true;
      } catch (primaryError) {
        console.warn(
          '⚠️ Primary connection config failed, trying fallback configs:',
          primaryError
        );

        const fallbackConfigs = [
          {
            dappMetadata: { name: 'Aztec Bridge and Seek' },
            permissions: [
              {
                chains: ['aztec:1337'],
                methods: ['register_contract', 'send_transaction'],
              },
            ],
          },
          {
            dappMetadata: { name: 'Aztec Bridge and Seek' },
            permissions: [
              {
                chains: ['aztec:31337'],
                methods: ['register_contract', 'send_transaction'],
              },
            ],
          },
          {
            dappMetadata: { name: 'Aztec Bridge and Seek' },
            permissions: [
              { chains: ['aztec:11155111'], methods: ['register_contract'] },
            ],
          },
        ];

        let lastError: unknown = primaryError;
        for (let i = 0; i < fallbackConfigs.length; i++) {
          try {
            console.log(`🔧 Trying fallback config ${i + 1}:`, fallbackConfigs[i]);
            accounts = await azguardServiceRef.current.connect(
              fallbackConfigs[i].dappMetadata,
              fallbackConfigs[i].permissions
            );
            connectionSuccessful = true;
            break;
          } catch (fallbackError) {
            console.warn(`⚠️ Fallback config ${i + 1} failed:`, fallbackError);
            lastError = fallbackError;
          }
        }

        if (!connectionSuccessful) {
          throw lastError;
        }
      }

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

  const handleAzguardDisconnect = async (): Promise<void> => {
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

  const handleSwitchAzguardAccount = async (
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

  const handleExecuteAzguardOperations = async (
    operations: Operation[]
  ): Promise<OperationResult[]> => {
    if (!azguardServiceRef.current) {
      throw new Error('Azguard service not initialized');
    }

    if (!azguardState.isConnected) {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const results = await azguardServiceRef.current.executeOperations(
        operations
      );
      console.log('✅ Azguard operations executed successfully:', results);
      return results;
    } catch (err) {
      console.error('❌ Failed to execute Azguard operations:', err);
      throw err;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIVERSAL ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleDisconnect = async (): Promise<void> => {
    if (walletType === WalletType.AZGUARD) {
      await handleAzguardDisconnect();
    } else if (walletType === WalletType.EMBEDDED) {
      disconnectEmbedded();
    }
  };

  const handleReinitialize = async (): Promise<void> => {
    return executeAsync(async () => {
      const services = await initializeWalletServices(config.nodeUrl);
      walletServicesRef.current = services;
      setIsInitialized(true);
    }, 'reinitialize wallet');
  };

  const getSponsoredFeePaymentMethod = useCallback(
    async (): Promise<SponsoredFeePaymentMethod> => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }
      return walletServicesRef.current.walletService.getSponsoredFeePaymentMethod();
    },
    []
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════

  const wallet = walletServicesRef.current?.walletService.getWallet() ?? null;
  const pxe = walletServicesRef.current?.walletService.getPXE() ?? null;
  const isConnected = account !== null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  const contextValue: UniversalWalletContextType = {
    // Unified state
    isConnected,
    isInitialized: isInitialized || forceWalletSelector,
    isLoading,
    error,
    walletType,
    account,

    // Services
    pxe,
    wallet,
    getSponsoredFeePaymentMethod,

    // Universal actions
    disconnect: handleDisconnect,
    reinitialize: handleReinitialize,

    // Embedded-specific
    embedded: {
      create: handleCreateAccount,
      connectTest: handleConnectTestAccount,
      connectExisting: handleConnectExistingAccount,
      isDeploying,
      forceShowSelector: () => setForceWalletSelector(true),
    },

    // Azguard-specific
    azguard: {
      connect: handleAzguardConnect,
      switchAccount: handleSwitchAzguardAccount,
      executeOperations: handleExecuteAzguardOperations,
      state: azguardState,
      client: azguardServiceRef.current?.getClient() ?? null,
    },
  };

  return (
    <UniversalWalletContext.Provider value={contextValue}>
      {children}
    </UniversalWalletContext.Provider>
  );
};
