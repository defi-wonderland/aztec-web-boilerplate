import { DEPLOYABLE_CONTRACTS } from '../config/deployableContracts';
import { PRECONFIGURED_CONTRACTS } from '../config/preconfiguredContracts';
import {
  getDeployableContractsForNetwork,
  findDeployableContract,
  findConstructor,
} from '../utils/deployableContracts';
import type { AztecNetwork } from '../config/networks/constants';

export const usePreconfiguredContracts = (networkName?: AztecNetwork) => {
  return PRECONFIGURED_CONTRACTS.filter(
    (c) => !c.network || c.network === networkName
  );
};

export const useDeployableContracts = (networkName?: AztecNetwork) => {
  return getDeployableContractsForNetwork(DEPLOYABLE_CONTRACTS, networkName);
};

export const findPreconfiguredContract = (
  id: string | null,
  networkName?: AztecNetwork
) => {
  if (!id) return null;
  return (
    PRECONFIGURED_CONTRACTS.find(
      (c) => c.id === id && (!c.network || c.network === networkName)
    ) ?? null
  );
};

export const findDeployableById = (
  id: string | null,
  networkName?: AztecNetwork
) => {
  if (!id) return null;
  const contracts = getDeployableContractsForNetwork(
    DEPLOYABLE_CONTRACTS,
    networkName
  );
  return findDeployableContract(contracts, id) ?? null;
};

export const findConstructorByName = (
  deployableId: string | null,
  constructorName: string | null,
  networkName?: AztecNetwork
) => {
  if (!deployableId || !constructorName) return null;
  const deployable = findDeployableById(deployableId, networkName);
  if (!deployable) return null;
  return findConstructor(deployable, constructorName) ?? null;
};
