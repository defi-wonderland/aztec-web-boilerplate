/**
 * Base error class for wallet service operations
 */
export class WalletServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'WalletServiceError';
  }
}

/**
 * Error thrown when PXE initialization fails
 */
export class PXEInitError extends WalletServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, 'PXE_INIT_FAILED', cause);
    this.name = 'PXEInitError';
  }
}

/**
 * Error thrown when account creation fails
 */
export class AccountCreationError extends WalletServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, 'ACCOUNT_CREATION_FAILED', cause);
    this.name = 'AccountCreationError';
  }
}

/**
 * Error thrown when account deployment fails
 */
export class AccountDeploymentError extends WalletServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, 'ACCOUNT_DEPLOYMENT_FAILED', cause);
    this.name = 'AccountDeploymentError';
  }
}

/**
 * Error thrown when loading existing account fails
 */
export class AccountLoadError extends WalletServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, 'ACCOUNT_LOAD_FAILED', cause);
    this.name = 'AccountLoadError';
  }
}

/**
 * Error thrown when external signer connection fails
 */
export class SignerConnectionError extends WalletServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, 'SIGNER_CONNECTION_FAILED', cause);
    this.name = 'SignerConnectionError';
  }
}

/**
 * Error thrown when no saved account is found
 */
export class NoSavedAccountError extends WalletServiceError {
  constructor() {
    super('No saved account found', 'NO_SAVED_ACCOUNT');
    this.name = 'NoSavedAccountError';
  }
}
