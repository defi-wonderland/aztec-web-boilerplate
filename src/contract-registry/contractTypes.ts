/**
 * Types derived from the contracts configuration.
 */
import { contractsConfig } from '../config/contracts';

/** Type representing the contracts config map */
export type ContractsConfig = typeof contractsConfig;

/**
 * Valid contract names derived from the config.
 * Provides autocomplete for contract names: 'dripper' | 'token' | ...
 */
export type ContractName = keyof ContractsConfig;
