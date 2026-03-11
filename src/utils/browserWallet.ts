import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { contractsConfig } from '../config/contracts';
import { getChainId, type AztecChainId } from '../config/networks/constants';
import { type ContractNames } from '../contract-registry';
import { NetworkConfig } from '../types/network';
import type { RegisterContractOp } from '../aztec-wallet/types/browserWallet';
import type { NetworkDeployments } from '../config/deployments/types';
import type { ResolvedArtifacts } from '../services/aztec/artifact';

interface BuildRegisterContractOperationsOptions {
  config: NetworkConfig;
  deployments: NetworkDeployments;
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
  deployments,
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

    const deployment = deployments[name];
    if (!deployment?.address || !deployment.salt || !deployment.deployer) {
      throw new Error(
        `Missing deployment data for contract "${name}". ` +
          `Add it to the deployment file for the "${config.name}" network.`
      );
    }

    const constructorArgs =
      typeof definition.constructorArgs === 'function'
        ? definition.constructorArgs(deployments)
        : definition.constructorArgs;

    const instance = await getContractInstanceFromInstantiationParams(
      artifact,
      {
        salt: Fr.fromString(deployment.salt),
        deployer: AztecAddress.fromString(deployment.deployer),
        constructorArgs,
        constructorArtifact: definition.constructorArtifact,
      }
    );

    const derivedAddress = instance.address.toString();
    if (derivedAddress !== deployment.address) {
      throw new Error(
        `Address mismatch for contract "${name}": ` +
          `deployment config has ${deployment.address} but derived ${derivedAddress} ` +
          `from instantiation params. Check salt, deployer, and constructor args.`
      );
    }

    operations.push({
      kind: 'register_contract',
      chain,
      address: derivedAddress,
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
