import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { contractsConfig } from '../config/contracts';
import { getChainId, type AztecChainId } from '../config/networks/constants';
import { type ContractNames } from '../contract-registry';
import type { NetworkConfig } from '../config/networks';
import type { ResolvedArtifacts } from '../services/aztec/artifact';
import type { RegisterContractOp } from '../use-aztec';

interface BuildRegisterContractOperationsOptions {
  config: NetworkConfig;
  artifacts: ResolvedArtifacts;
  chainOverride?: AztecChainId;
}

/**
 * Build all contract registration operations for browser wallets.
 * Registers ALL app contracts (lazyRegister is ignored for browser wallets
 * since they manage their own PXE and don't support lazy loading).
 */
export const buildRegisterContractOperations = async ({
  config,
  artifacts,
  chainOverride,
}: BuildRegisterContractOperationsOptions): Promise<RegisterContractOp[]> => {
  const chain = chainOverride ?? getChainId(config.name);
  const operations: RegisterContractOp[] = [];

  const contractNames = Object.keys(contractsConfig) as ContractNames<
    typeof contractsConfig
  >[];

  for (const name of contractNames) {
    const definition = contractsConfig[name];
    if (!definition) {
      continue;
    }
    const artifact = artifacts[name];
    if (!artifact) {
      throw new Error(
        `Missing resolved artifact for contract "${name}". ` +
          `Ensure artifact sources are configured and resolved before registering.`
      );
    }

    const deployParams = definition.deployParams(config);
    const instance = await getContractInstanceFromInstantiationParams(
      artifact,
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
      artifact,
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
