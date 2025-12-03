import type { RegisterContractOperation } from '@azguardwallet/types';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import type { AppConfig } from '../config/networks';
import { getAzguardChainId } from '../config/networks/constants';
import { aztecContracts, CORE_CONTRACTS } from '../config/contracts';
import type { ContractNames } from '../contract-registry';

type KnownContract = ContractNames<typeof aztecContracts>;

/**
 * Build all contract registration operations for Azguard
 * Registers app-specific contracts (dripper, token) with full instance and artifact
 * 
 * Note: Sponsored FPC is NOT registered here - users should add it manually
 * via Azguard Settings > FPCs if they want sponsored (free) transactions.
 * Attempting to register it programmatically causes circuit errors.
 */
export const buildRegisterContractOperations = async (
  config: AppConfig,
  contractNames: KnownContract[] = CORE_CONTRACTS as KnownContract[]
): Promise<RegisterContractOperation[]> => {
  const chain = getAzguardChainId(config.name);
  const operations: RegisterContractOperation[] = [];

  // Register app-specific contracts with full instance and artifact
  for (const name of contractNames) {
    const definition = aztecContracts[name];
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

  return operations;
};

