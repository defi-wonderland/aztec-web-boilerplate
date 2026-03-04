import type { ContractConfigMap } from '@contract-registry';
import type { FeatureModule } from './types';

interface FeatureModuleFile {
  default: FeatureModule;
}

const discoveredFiles = import.meta.glob<FeatureModuleFile>(
  './**/feature.tsx',
  {
    eager: true,
  }
);

type DiscoveredEntry = {
  path: string;
  feature: FeatureModule;
};

const discoveredEntries: DiscoveredEntry[] = Object.entries(
  discoveredFiles
).map(([path, mod]) => {
  if (!mod?.default) {
    throw new Error(`Feature module "${path}" must export a default feature`);
  }

  return {
    path,
    feature: mod.default,
  };
});

const assertUniqueFeatureIds = (entries: DiscoveredEntry[]) => {
  const byId = new Map<string, string[]>();

  for (const { path, feature } of entries) {
    byId.set(feature.id, [...(byId.get(feature.id) ?? []), path]);
  }

  const duplicates = [...byId.entries()].filter(
    ([, paths]) => paths.length > 1
  );

  if (duplicates.length === 0) return;

  const details = duplicates
    .map(([id, paths]) => `- "${id}" in:\n  ${paths.join('\n  ')}`)
    .join('\n');

  throw new Error(`Duplicate feature ids detected:\n${details}`);
};

assertUniqueFeatureIds(discoveredEntries);

export const FEATURES: FeatureModule[] = discoveredEntries
  .map((entry) => entry.feature)
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export const FEATURE_BY_ID = new Map(
  FEATURES.map((feature) => [feature.id, feature])
);

export type ContractFeatureLike = Pick<FeatureModule, 'id' | 'contracts'>;

export const collectContractsFromFeatures = (
  features: ContractFeatureLike[]
): ContractConfigMap => {
  const merged: ContractConfigMap = {};
  const ownerByContractName = new Map<string, string>();

  for (const feature of features) {
    if (!feature.contracts) continue;

    for (const [contractName, contractDefinition] of Object.entries(
      feature.contracts
    )) {
      const existingOwner = ownerByContractName.get(contractName);
      if (existingOwner) {
        throw new Error(
          `Duplicate contract config "${contractName}" found in features "${existingOwner}" and "${feature.id}"`
        );
      }

      ownerByContractName.set(contractName, feature.id);
      merged[contractName] = contractDefinition;
    }
  }

  return merged;
};

export const collectFeatureContracts = (): ContractConfigMap => {
  return collectContractsFromFeatures(FEATURES);
};
