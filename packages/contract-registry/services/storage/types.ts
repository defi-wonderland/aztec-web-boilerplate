/**
 * Cached contract metadata.
 */
export interface CachedContract {
  address: string;
  artifactKey?: string;
  label?: string;
}

/**
 * Contracts list stored per network.
 */
export interface ContractsRecord {
  network: string;
  contracts: CachedContract[];
}
