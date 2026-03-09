import { useMemo } from 'react';
import {
  DEPLOYABLE_CONTRACTS,
  PRECONFIGURED_CONTRACTS,
  type PreconfiguredContract,
} from '../components/contract-interaction/presets';
import { ArtifactService } from '../services/aztec/artifact/ArtifactService';
import {
  getDeployableContractsForNetwork,
  findDeployableContract,
  findConstructor,
  resolveDeployableContract,
  type DeployableContract,
} from '../utils/deployableContracts';
import type { AztecNetwork } from '../types/network';

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
 * Returns artifactJson string using ArtifactService's full
 * fallback chain (cache → registry → external → local).
 */
export const resolvePreconfiguredArtifact = async (
  contract: PreconfiguredContract
): Promise<string | null> => {
  if ('artifactJson' in contract && contract.artifactJson) {
    return contract.artifactJson;
  }

  if (contract.artifactSources && contract.classId) {
    const { artifact } = await ArtifactService.getInstance().loadArtifact(
      contract.id,
      contract.artifactSources,
      contract.classId
    );
    return JSON.stringify(artifact);
  }

  return null;
};

/**
 * Resolve artifact for a deployable contract.
 * Uses ArtifactService's full fallback chain (cache → registry → external → local).
 * Returns fully hydrated DeployableContract with constructors.
 */
export const resolveDeployableArtifact = async (
  contract: DeployableContract
): Promise<DeployableContract> => {
  if (!contract.classId || contract.artifactJson) {
    return contract;
  }

  if (!contract.artifactSources) {
    return contract;
  }

  const { artifact } = await ArtifactService.getInstance().loadArtifact(
    contract.id,
    contract.artifactSources,
    contract.classId
  );
  return resolveDeployableContract(contract, artifact);
};
