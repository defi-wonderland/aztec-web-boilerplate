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

/**
 * Build all contract registration operations for Azguard
 * Registers app-specific contracts (dripper, token) with full instance and artifact
 * 
 * Note: Sponsored FPC is NOT registered here as it causes circuit/proof errors.
 * Users should add it manually via Azguard Settings > FPCs for sponsored transactions.
 * The FPC address is logged to console for easy copying.
 */
export const buildRegisterContractOperations = async (
  config: AppConfig,
  contractNames: KnownContract[] = CORE_CONTRACTS as KnownContract[]
): Promise<RegisterContractOperation[]> => {
  const chain = getAzguardChainId(config.name);
  const operations: RegisterContractOperation[] = [];

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

  // Log the Sponsored FPC address for users to manually add in Azguard Settings > FPCs
  // Note: We don't register it programmatically as it causes proof verification errors
  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );

  const fpcAddress = sponsoredFPCInstance.address.toString();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📍 SPONSORED FPC ADDRESS (copy this to add in Azguard Settings > FPCs):');
  console.log(`   ${fpcAddress}`);
  console.log('═══════════════════════════════════════════════════════════════');

  return operations;
};

