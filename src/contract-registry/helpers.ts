import type { ContractConfigMap } from './types';

export const createContractConfig = <const T extends ContractConfigMap>(
  configs: T
): T => {
  for (const [name, config] of Object.entries(configs)) {
    if (!config.constructorArtifact) {
      throw new Error(
        `Contract "${name}" is missing required "constructorArtifact" field`
      );
    }
    if (!config.artifactSources) {
      throw new Error(
        `Contract "${name}" is missing required "artifactSources" field`
      );
    }
  }
  return configs;
};
