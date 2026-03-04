import type { ContractConfigMap } from './types';

export const createContractConfig = <const T extends ContractConfigMap>(
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
    if (typeof config.artifactSources !== 'function') {
      throw new Error(
        `Contract "${name}" is missing required "artifactSources" function`
      );
    }
  }
  return configs;
};
