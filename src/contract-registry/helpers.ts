import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Point } from '@aztec/foundation/curves/grumpkin';
import { PublicKeys } from '@aztec/stdlib/keys';
import type { ContractConfigMap, ContractConfigDefinition } from './types';
import type { NetworkConfig, RawPublicKeys } from '../config/networks';

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

/**
 * Convert raw public key strings to PublicKeys object.
 * Returns undefined if no raw keys provided (uses default keys).
 * Async to ensure WASM (Barretenberg) is initialized before Point operations.
 */
export const getPublicKeys = async (
  rawKeys: RawPublicKeys | undefined
): Promise<PublicKeys | undefined> => {
  if (!rawKeys) {
    return undefined;
  }
  // Ensure Barretenberg WASM is initialized before Point.fromString
  const { BarretenbergSync } = await import('@aztec/bb.js');
  await BarretenbergSync.initSingleton();

  return new PublicKeys(
    Point.fromString(rawKeys.masterNullifierPublicKey),
    Point.fromString(rawKeys.masterIncomingViewingPublicKey),
    Point.fromString(rawKeys.masterOutgoingViewingPublicKey),
    Point.fromString(rawKeys.masterTaggingPublicKey)
  );
};

/**
 * Get public keys for the dripper contract
 */
export const getDripperPublicKeys = (
  config: NetworkConfig
): Promise<PublicKeys | undefined> => {
  return getPublicKeys(config.dripperPublicKeys);
};

/**
 * Get public keys for the token contract
 */
export const getTokenPublicKeys = (
  config: NetworkConfig
): Promise<PublicKeys | undefined> => {
  return getPublicKeys(config.tokenPublicKeys);
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
    console.log('[getContractsForConfig] No overrides, using base contracts');
    return baseContracts;
  }

  console.log(
    '[getContractsForConfig] Applying artifact overrides:',
    Object.keys(artifactOverrides)
  );

  const result = { ...baseContracts } as Record<
    string,
    ContractConfigDefinition<NetworkConfig>
  >;

  for (const [name, artifact] of Object.entries(artifactOverrides)) {
    if (name in result && result[name]) {
      const originalArtifact = result[name].artifact;
      result[name] = {
        ...result[name],
        artifact,
      };
      console.log(`[getContractsForConfig] Overriding "${name}":`, {
        originalName: originalArtifact.name,
        overrideName: artifact.name,
        overrideFunctions: artifact.functions?.length,
      });
    }
  }

  return result as T;
};
