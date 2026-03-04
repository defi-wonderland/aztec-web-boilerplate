import { describe, expect, it } from 'vitest';
import type { ContractConfigMap } from '@contract-registry';
import {
  FEATURES,
  FEATURE_BY_ID,
  collectFeatureContracts,
  collectContractsFromFeatures,
  type ContractFeatureLike,
} from '../../../src/features/registry';

const fakeContracts = (names: string[]): ContractConfigMap => {
  return Object.fromEntries(
    names.map((name) => [name, {}])
  ) as ContractConfigMap;
};

describe('feature registry', () => {
  it('discovers features and indexes them by id', () => {
    expect(FEATURES.length).toBeGreaterThan(0);

    const ids = FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(FEATURE_BY_ID.get(id)).toBeDefined();
    }
  });

  it('collects feature contracts without duplicate names', () => {
    const contracts = collectFeatureContracts();
    const contractNames = Object.keys(contracts);

    expect(new Set(contractNames).size).toBe(contractNames.length);
  });

  it('throws when two features declare the same contract name', () => {
    const features: ContractFeatureLike[] = [
      { id: 'feature-a', contracts: fakeContracts(['shared']) },
      { id: 'feature-b', contracts: fakeContracts(['shared']) },
    ];

    expect(() => collectContractsFromFeatures(features)).toThrow(
      'Duplicate contract config "shared"'
    );
  });

  it('merges distinct contract names across features', () => {
    const features: ContractFeatureLike[] = [
      { id: 'feature-a', contracts: fakeContracts(['alpha']) },
      { id: 'feature-b', contracts: fakeContracts(['beta']) },
    ];

    const merged = collectContractsFromFeatures(features);
    expect(Object.keys(merged).sort()).toEqual(['alpha', 'beta']);
  });
});
