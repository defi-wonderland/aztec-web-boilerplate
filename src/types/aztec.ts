/**
 * Re-export aztec types from aztec-wallet library.
 * These types are the canonical source and should be imported from here
 * for boilerplate code, or directly from aztec-wallet for library consumers.
 */
export type {
  AccountData,
  IAztecStorageService,
  CreateAccountResult,
  AccountCredentials,
  AzguardAccountData,
} from '../aztec-wallet/types/aztec';

export { WalletType, ExternalSignerType } from '../aztec-wallet/types/aztec';
