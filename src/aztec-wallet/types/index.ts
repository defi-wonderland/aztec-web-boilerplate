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
  EVMWalletsGroupConfig,
  EVMWalletConfig,
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
  | 'evm-wallets'
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
