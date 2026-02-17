import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractConfigMap } from './types';
import type { NetworkConfig } from '../config/networks';

export const createContractConfig = <
  const T extends ContractConfigMap<NetworkConfig>,
>(
  configs: T
): T => {
  for (const [name, config] of Object.entries(configs)) {
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
    if (!config.artifactSources) {
      throw new Error(
        `Contract "${name}" is missing required "artifactSources" function`
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
