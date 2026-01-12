import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { ExternalSigner } from '../../signers/types';
import type { ExternalSignerType, WalletType } from '../../types/aztec';
import type { IBrowserWalletAdapter } from '../../types/browserWallet';
import type {
  ConnectionStatus,
  WalletConnector,
  WalletConnectorId,
} from '../../types/walletConnector';

export type PXEStatus = 'idle' | 'initializing' | 'ready' | 'error';

export type WalletState = {
  // Core state (always relevant)
  account: AccountWithSecretKey | null;
  walletType: WalletType | null;
  status: ConnectionStatus;
  error: string | null;

  // PXE initialization flags (services stay in singleton)
  pxeStatus: PXEStatus;
  pxeError: string | null;

  // ExternalSigner-specific (only read when walletType === EXTERNAL_SIGNER)
  signerType: ExternalSignerType | null;
  connectedRdns: string | null;

  // BrowserWallet-specific (only read when walletType === BROWSER_WALLET)
  caipAccount: string | null;
  caipAccounts: string[];
  supportedChains: string[];
  isInstalled: boolean;

  // Connector management
  connectors: WalletConnector[];
  activeConnectorId: WalletConnectorId | null;
  connectingConnectorId: WalletConnectorId | null;
};

export type WalletActions = {
  _connectWith: <T>(
    connectorId: WalletConnectorId,
    run: (connector: WalletConnector) => Promise<T>
  ) => Promise<T>;
  // Connector management
  setConnectors: (connectors: WalletConnector[]) => void;
  connect: (connectorId: WalletConnectorId) => Promise<void>;

  // Embedded
  connectEmbedded: (
    connectorId?: WalletConnectorId
  ) => Promise<AccountWithSecretKey>;
  connectExistingEmbedded: (
    connectorId?: WalletConnectorId
  ) => Promise<AccountWithSecretKey | null>;
  hasSavedEmbeddedAccount: () => boolean;

  // External Signer
  connectExternalSigner: (
    signer: ExternalSigner,
    connectorId?: WalletConnectorId
  ) => Promise<AccountWithSecretKey>;

  // Browser Wallet
  connectBrowserWallet: (
    adapter: IBrowserWalletAdapter,
    networkName: string,
    connectorId?: WalletConnectorId
  ) => Promise<void>;
  setBrowserWalletState: (
    state: Partial<
      Pick<
        WalletState,
        'caipAccount' | 'caipAccounts' | 'supportedChains' | 'isInstalled'
      >
    >
  ) => void;

  // Shared
  disconnect: () => void;
  setError: (error: string | null) => void;
  setPXEStatus: (status: PXEStatus, error?: string | null) => void;
  reset: () => void;
};

export type WalletStore = WalletState & WalletActions;

// Helper types for action creators
export type SetState = (
  partial: Partial<WalletStore> | ((state: WalletStore) => Partial<WalletStore>)
) => void;

export type GetState = () => WalletStore;
