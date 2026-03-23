// Wallet connector types & type guards
export type {
  WalletConnectorId,
  ConnectionStatus as ConnectorConnectionStatus,
  ConnectorStatus,
  WalletConnector,
  EmbeddedWalletConnector,
  BrowserWalletConnector as BrowserWalletConnectorInterface,
} from './walletConnector';
export {
  isEmbeddedConnector,
  isBrowserWalletConnector,
  hasAppManagedPXE,
} from './walletConnector';

// Browser wallet adapter types
export type {
  BrowserWalletState,
  IBrowserWalletAdapter,
  BrowserWalletAdapterFactory,
} from './browserWalletAdapter';

// Browser wallet operation types
export type {
  BrowserWalletOperationResult,
  BrowserWalletOperation,
  SimulateViewsOp,
  SendTransactionOp,
  GetTxReceiptOp,
  RegisterContractOp,
  ContractCall,
  ConnectorTransactionAction,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from './browserWallet';

// Config types
export type {
  IconType,
  AztecWalletConfig,
  ResolvedAztecWalletConfig,
  NetworkPreset,
  StoreNetworkPreset,
  WalletGroupsConfig,
  EmbeddedGroupConfig,
  AztecWalletsGroupConfig,
  AztecBrowserWalletConfig,
} from './config';

// Aztec wallet types
export type {
  AccountData,
  IAztecStorageService,
  CreateAccountResult,
  AccountCredentials,
  AzguardAccountData,
  ModalWalletType,
} from './aztec';
export { WalletType, ExternalSignerType } from './aztec';
import type { ModalWalletType } from './aztec';

// Theme types
export type {
  ThemeConfig,
  PartialThemeConfig,
  ThemeColors,
  ThemeRadii,
  ThemeFonts,
  ThemeShadows,
  ThemeSpacing,
} from '../theme/types';

// Network picker variant
export type NetworkPickerVariant = 'full' | 'compact';

// Modal view types
export type ModalView =
  | 'main'
  | 'aztec-wallets'
  | 'connecting'
  | 'success';

// Connection state types
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  error: string | null;
  walletId: string | null;
  walletType: ModalWalletType | null;
}
