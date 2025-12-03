import type { RegisterContractOperation } from '@azguardwallet/types';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import type { AppConfig } from '../config/networks';
import { getAzguardChainId } from '../config/networks/constants';
import { aztecContracts, CORE_CONTRACTS } from '../config/contracts';
import type { ContractNames } from '../contract-registry';

type KnownContract = ContractNames<typeof aztecContracts>;

const getSponsoredFPCAddress = async (): Promise<string> => {
  const instance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );
  return instance.address.toString();
};

export const buildRegisterContractOperations = async (
  config: AppConfig,
  contractNames: KnownContract[] = CORE_CONTRACTS as KnownContract[]
): Promise<RegisterContractOperation[]> => {
  const chain = getAzguardChainId(config.name);
  const operations: RegisterContractOperation[] = [];

  try {
    const sponsoredFPCAddress = await getSponsoredFPCAddress();
    operations.push({
      kind: 'register_contract',
      chain,
      address: sponsoredFPCAddress,
    });
  } catch (err) {
    console.warn('⚠️ Failed to prepare Sponsored FPC registration:', err);
  }

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

