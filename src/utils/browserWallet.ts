import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { contractsConfig } from '../config/contracts';
import { getNetworkArtifacts } from '../config/networkArtifacts';
import { getChainId, type AztecChainId } from '../config/networks/constants';
import {
  getContractsForConfig,
  type ContractNames,
} from '../contract-registry';
import type { NetworkConfig } from '../config/networks';
import type { RegisterContractOp } from '../types/browserWallet';

/**
 * Build all contract registration operations for browser wallets.
 * Registers ALL app contracts (lazyRegister is ignored for browser wallets
 * since they manage their own PXE and don't support lazy loading).
 */
export const buildRegisterContractOperations = async (
  config: NetworkConfig,
  chainOverride?: AztecChainId
): Promise<RegisterContractOp[]> => {
  const chain = chainOverride ?? getChainId(config.name);
  const operations: RegisterContractOp[] = [];
  const contracts = getContractsForConfig(
    contractsConfig,
    getNetworkArtifacts(config.name)
  );

  const contractNames = Object.keys(contracts) as ContractNames<
    typeof contractsConfig
  >[];

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
