// Errors
export {
  WalletServiceError,
  PXEInitError,
  AccountCreationError,
  AccountDeploymentError,
  AccountLoadError,
  SignerConnectionError,
  NoSavedAccountError,
} from './errors';

// Deployment
export { deployAccountIfNotExists } from './deployAccount';
export type {
  DeployAccountOptions,
  DeployAccountResult,
} from './deployAccount';

// Embedded account
export {
  createEmbeddedAccount,
  loadExistingEmbeddedAccount,
  getSavedAccount,
  saveAccount,
  clearSavedAccount,
  hasSavedEmbeddedAccount,
} from './embeddedAccount';
export type {
  CreateEmbeddedAccountResult,
  LoadEmbeddedAccountResult,
  StoredAccountData,
} from './embeddedAccount';

// External signer account
export { createExternalSignerAccount } from './externalSignerAccount';
export type { CreateExternalSignerAccountResult } from './externalSignerAccount';
