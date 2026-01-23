import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractConfigMap, ContractConfigDefinition } from './types';
import type { NetworkConfig } from '../config/networks';

export const createContractConfig = <
  const T extends ContractConfigMap<NetworkConfig>,
>(
  configs: T
): T => {
  for (const [name, config] of Object.entries(configs)) {
    if (!config.artifact) {
      throw new Error(
        `Contract "${name}" is missing required "artifact" property`
      );
    }
    if (typeof config.address !== 'function') {
      throw new Error(
        `Contract "${name}" is missing required "address" function`
      );
    }
    if (typeof config.deployParams !== 'function') {
      throw new Error(
        `Contract "${name}" is missing required "deployParams" function`
      );
    }
  }
  return configs;
};

// =============================================================================
// Deploy Params Helpers
// =============================================================================

/**
 * Helper to resolve deployer address per network
 */
export const getDeployerAddress = (config: NetworkConfig): AztecAddress => {
  if (config.name === 'sandbox') {
    return AztecAddress.ZERO;
  }
  return config.deployerAddress
    ? AztecAddress.fromString(config.deployerAddress)
    : AztecAddress.ZERO;
};

/**
 * Helper to build token constructor args per network
 */
export const getTokenConstructorArgs = (config: NetworkConfig) => {
  const minterAddress = AztecAddress.fromString(config.dripperContractAddress);
  if (config.name === 'devnet') {
    return ['WETH', 'WETH', 18, minterAddress, AztecAddress.ZERO] as const;
  }
  return ['Yield Token', 'YT', 18, minterAddress, AztecAddress.ZERO] as const;
};

// =============================================================================
// Network-specific Artifact Overrides
// =============================================================================

/**
 * Artifact overrides per network. Keys are contract names, values are artifacts.
 */
export type ArtifactOverrides = Record<string, ContractArtifact>;

/**
 * Returns contract configs with optional artifact overrides applied.
 *
 * @param baseContracts - The base contract configurations
 * @param artifactOverrides - Optional map of contract name to artifact override
 *
 * @example
 * ```typescript
 * const contracts = getContractsForConfig(contractsConfig, {
 *   dripper: DRIPPER_DEVNET_ARTIFACT,
 *   token: TOKEN_DEVNET_ARTIFACT,
 * });
 * ```
 */
export const getContractsForConfig = <T extends ContractConfigMap>(
  baseContracts: T,
  artifactOverrides?: ArtifactOverrides
): T => {
  if (!artifactOverrides || Object.keys(artifactOverrides).length === 0) {
    return baseContracts;
  }

  const result = { ...baseContracts } as Record<
    string,
    ContractConfigDefinition<NetworkConfig>
  >;

  for (const [name, artifact] of Object.entries(artifactOverrides)) {
    if (name in result && result[name]) {
      result[name] = {
        ...result[name],
        artifact,
      };
    }
  }

  return result as T;
};
