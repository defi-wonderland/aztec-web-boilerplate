import type { RegisterContractOperation, CaipAccount } from '@azguardwallet/types';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import type { NetworkConfig } from '../config/networks';
import { getChainId, type AztecChainId } from '../config/networks/constants';
import { contractsConfig } from '../config/contracts';
import { getContractsForConfig, type ContractNames } from '../contract-registry';
import { getNetworkArtifacts } from '../config/networkArtifacts';

/**
 * Extracts the chain identifier from a CAIP account string.
 * CAIP format: namespace:chainId:address (e.g., "aztec:testnet:0x1234...")
 *
 * @param caipAccount - The full CAIP account string
 * @returns The chain identifier (e.g., "aztec:testnet")
 */
export const getChainFromCaipAccount = (caipAccount: CaipAccount): string => {
  const [namespace, chainId] = caipAccount.split(':');
  return `${namespace}:${chainId}`;
};

/**
 * Build all contract registration operations for Azguard.
 * Registers ALL app contracts (lazyRegister is ignored for browser wallets
 * since they manage their own PXE and don't support lazy loading).
 */
export const buildRegisterContractOperations = async (
  config: NetworkConfig,
  chainOverride?: AztecChainId
): Promise<RegisterContractOperation[]> => {
  const chain = chainOverride ?? getChainId(config.name);
  const operations: RegisterContractOperation[] = [];
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
