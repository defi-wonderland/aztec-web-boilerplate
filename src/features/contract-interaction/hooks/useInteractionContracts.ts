import { useMemo } from 'react';
import {
  ArtifactRegistryService,
  ArtifactService,
  type ArtifactSourceConfig,
} from '@contract-registry';
import {
  getDeployableContractsForNetwork,
  findDeployableContract,
  findConstructor,
  resolveDeployableContract,
  type DeployableContract,
} from '../../../utils/deployableContracts';
import { getEnv } from '../../../utils/env';
import {
  DEPLOYABLE_CONTRACTS,
  PRECONFIGURED_CONTRACTS,
} from '../config/presets';
import type { AztecNetwork } from '../../../config/networks/constants';
import type { PreconfiguredContract } from '../../../types/preconfiguredContract';

const REGISTRY_URL = getEnv().artifactRegistryUrl;

export const usePreconfiguredContracts = (networkName?: AztecNetwork) => {
  return useMemo(() => {
    return PRECONFIGURED_CONTRACTS.filter(
      (c) => !c.network || c.network === networkName
    );
  }, [networkName]);
};

export const useDeployableContracts = (networkName?: AztecNetwork) => {
  return useMemo(() => {
    return getDeployableContractsForNetwork(DEPLOYABLE_CONTRACTS, networkName);
  }, [networkName]);
};

export const useFindPreconfiguredContract = (
  id: string | null,
  networkName?: AztecNetwork
): PreconfiguredContract | null => {
  return useMemo(() => {
    if (!id) return null;
    return (
      PRECONFIGURED_CONTRACTS.find(
        (c) => c.id === id && (!c.network || c.network === networkName)
      ) ?? null
    );
  }, [id, networkName]);
};

export const useFindDeployableById = (
  id: string | null,
  networkName?: AztecNetwork
): DeployableContract | null => {
  return useMemo(() => {
    if (!id) return null;
    const contracts = getDeployableContractsForNetwork(
      DEPLOYABLE_CONTRACTS,
      networkName
    );
    return findDeployableContract(contracts, id) ?? null;
  }, [id, networkName]);
};

export const findConstructorByName = (
  deployable: DeployableContract | null,
  constructorName: string | null
) => {
  if (!deployable || !constructorName) return null;
  return findConstructor(deployable, constructorName) ?? null;
};

/**
 * Build the ordered fallback chain for a preconfigured contract.
 * Registry is preferred (fetches by classId), with embedded artifactJson as local fallback.
 */
function buildPreconfiguredSources(
  contract: PreconfiguredContract
): ArtifactSourceConfig[] {
  const sources: ArtifactSourceConfig[] = [];

  if (contract.classId && REGISTRY_URL) {
    sources.push({ registry: REGISTRY_URL });
  }

  if (contract.artifactJson) {
    sources.push({ local: JSON.parse(contract.artifactJson) });
  }

  return sources;
}

/**
 * Resolve artifact for a preconfigured contract using the standard fallback chain.
 * Sources are tried in order (registry → local), first success wins.
 */
export const resolvePreconfiguredArtifact = async (
  contract: PreconfiguredContract
): Promise<string | null> => {
  const sources = buildPreconfiguredSources(contract);
  if (sources.length === 0) return null;

  const { artifact } = await ArtifactService.getInstance().loadSingleArtifact(
    contract.id,
    sources,
    contract.classId
  );

  return JSON.stringify(artifact);
};

/**
 * Resolve artifact for a deployable contract.
 * Uses ArtifactRegistryService which has three-tier caching:
 * 1. Memory cache (instant, populated during app init)
 * 2. IndexedDB (fast, persisted across sessions)
 * 3. Network (only if not cached)
 *
 * Returns fully hydrated DeployableContract with constructors.
 */
export const resolveDeployableArtifact = async (
  contract: DeployableContract
): Promise<DeployableContract> => {
  if (!contract.classId || contract.artifactJson) {
    return contract;
  }

  if (!REGISTRY_URL) {
    return contract;
  }

  // ArtifactRegistryService is a singleton - same instance used by app init
  // Memory cache is populated during init, so this returns instantly for known classIds
  const service = ArtifactRegistryService.getInstance(REGISTRY_URL);
  const { artifact } = await service.getArtifact(contract.classId);
  return resolveDeployableContract(contract, artifact);
};
