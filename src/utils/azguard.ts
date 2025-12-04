import type { RegisterContractOperation } from '@azguardwallet/types';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import type { AppConfig } from '../config/networks';
import {
  getChainId,
  type AztecChainId,
} from '../config/networks/constants';
import {
  aztecContracts,
  CORE_CONTRACTS,
  getContractsForConfig,
} from '../config/contracts';
import type { ContractNames } from '../contract-registry';

type KnownContract = ContractNames<typeof aztecContracts>;

/**
 * Build all contract registration operations for Azguard
 * Registers app-specific contracts with full instance and artifact
 */
export const buildRegisterContractOperations = async (
  config: AppConfig,
  contractNames: KnownContract[] = CORE_CONTRACTS as KnownContract[],
  chainOverride?: AztecChainId
): Promise<RegisterContractOperation[]> => {
  const chain = chainOverride ?? getChainId(config.name);
  const operations: RegisterContractOperation[] = [];
  const contracts = getContractsForConfig(config);

  for (const name of contractNames) {
    const definition = contracts[name];
    if (!definition) {
      continue;
    }

    const deployParams = definition.deployParams(config);
    const instance = await getContractInstanceFromInstantiationParams(
      definition.artifact,
      {
        salt: deployParams.salt,
        deployer: deployParams.deployer,
        constructorArgs: deployParams.constructorArgs,
        constructorArtifact: deployParams.constructorArtifact,
      }
    );

    operations.push({
      kind: 'register_contract',
      chain,
      address: definition.address(config),
      instance,
      artifact: definition.artifact,
    });
  }

  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );

  operations.push({
    kind: 'register_contract',
    chain,
    address: sponsoredFPCInstance.address.toString(),
    instance: sponsoredFPCInstance,
    artifact: SponsoredFPCContractArtifact,
  });

  return operations;
};
