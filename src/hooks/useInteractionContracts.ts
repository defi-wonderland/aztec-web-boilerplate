import { useMemo } from 'react';
import { DEPLOYABLE_CONTRACTS } from '../config/deployableContracts';
import {
  PRECONFIGURED_CONTRACTS,
  type PreconfiguredContract,
} from '../config/preconfiguredContracts';
import { ArtifactRegistryService } from '../services/aztec/artifactRegistry';
import {
  getDeployableContractsForNetwork,
  findDeployableContract,
  findConstructor,
  resolveDeployableContract,
  type DeployableContract,
} from '../utils/deployableContracts';
import type { AztecNetwork } from '../config/networks/constants';

const REGISTRY_URL = import.meta.env.VITE_ARTIFACT_REGISTRY_URL;

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
 * Resolve artifact for a preconfigured contract.
 * Returns artifactJson string, fetching from registry if needed.
 * Preconfigured contracts by default are trusted, so validation is skipped for performance.
 */
export const resolvePreconfiguredArtifact = async (
  contract: PreconfiguredContract
): Promise<string | null> => {
  if ('artifactJson' in contract && contract.artifactJson) {
    return contract.artifactJson;
  }

  if ('classId' in contract && contract.classId && REGISTRY_URL) {
    const service = ArtifactRegistryService.getInstance(REGISTRY_URL);
    const cachedString = service.getStringifiedArtifact(contract.classId);
    if (cachedString) {
      return cachedString;
    }
    await service.getArtifact(contract.classId, { skipValidation: true });
    return service.getStringifiedArtifact(contract.classId);
  }

  return null;
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
