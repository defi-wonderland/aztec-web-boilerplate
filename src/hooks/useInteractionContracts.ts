import { useMemo } from 'react';
import { useAztecWallet } from '../aztec-wallet';
import {
  DEPLOYABLE_CONTRACTS,
  PRECONFIGURED_CONTRACTS,
} from '../components/contract-interaction/presets';
import { ArtifactService } from '../services/aztec/artifact/ArtifactService';
import {
  getDeployableContractsForNetwork,
  findDeployableContract,
  findConstructor,
  resolveDeployableContract,
  type DeployableContract,
} from '../utils/deployableContracts';
import type { PreconfiguredContract } from '../types/preconfiguredContract';

export const usePreconfiguredContracts = () => {
  const { networkName } = useAztecWallet();
  return useMemo(() => {
    return PRECONFIGURED_CONTRACTS.filter(
      (c) => !c.network || c.network === networkName
    );
  }, [networkName]);
};

export const useDeployableContracts = () => {
  const { networkName } = useAztecWallet();
  return useMemo(() => {
    return getDeployableContractsForNetwork(DEPLOYABLE_CONTRACTS, networkName);
  }, [networkName]);
};

export const useFindPreconfiguredContract = (
  id: string | null
): PreconfiguredContract | null => {
  const { networkName } = useAztecWallet();
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
  id: string | null
): DeployableContract | null => {
  const { networkName } = useAztecWallet();
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
  // Prefer ArtifactService (registry → local fallback chain) when available
  if (contract.artifactSources && contract.classId) {
    const { artifact } = await ArtifactService.getInstance().loadArtifact(
      contract.id,
      contract.artifactSources,
      contract.classId
    );
    return JSON.stringify(artifact);
  }

  // Fall back to local artifactJson when no source chain is configured
  if ('artifactJson' in contract && contract.artifactJson) {
    return contract.artifactJson;
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
  // Prefer ArtifactService (registry → local fallback chain) when available
  if (contract.classId && contract.artifactSources) {
    const { artifact } = await ArtifactService.getInstance().loadArtifact(
      contract.id,
      contract.artifactSources,
      contract.classId
    );
    return resolveDeployableContract(contract, artifact);
  }

  return contract;
};
