import type { RegisterContractOperation, CaipAccount } from '@azguardwallet/types';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import type { NetworkConfig } from '../config/networks';
import { getChainId, type AztecChainId } from '../config/networks/constants';
import { contractsConfig } from '../config/contracts';
import { getContractsForConfig, type ContractNames } from '../contract-registry';
import { getNetworkArtifacts } from '../config/networkArtifacts';

/**
 * Add `isInternal: false` to an object if missing (required by Azguard schema).
 */
const addIsInternal = <T extends object>(obj: T): T & { isInternal: boolean } => {
  return {
    ...obj,
    isInternal: (obj as T & { isInternal?: boolean }).isInternal ?? false,
  };
};

/**
 * Normalize a contract artifact to be compatible with Azguard wallet.
 * The new aztec-nr artifacts don't include `isInternal` on functions,
 * but Azguard wallet (v0.6.0) expects it.
 */
export const normalizeArtifactForAzguard = (artifact: ContractArtifact): unknown => {
  // Cast to unknown since we're adding fields not in the official type
  const normalized = {
    ...artifact,
    functions: artifact.functions.map(addIsInternal),
    ...(artifact.nonDispatchPublicFunctions && {
      nonDispatchPublicFunctions: artifact.nonDispatchPublicFunctions.map(addIsInternal),
    }),
  };
  return normalized;
};

/**
 * Extracts the chain identifier from a CAIP account string.
 * CAIP format: namespace:chainId:address (e.g., "aztec:testnet:0x1234...")
 *
 * @param caipAccount - The full CAIP account string
 * @returns The chain identifier (e.g., "aztec:testnet")
 */
export const getChainFromCaipAccount = (caipAccount: CaipAccount | string): string => {
  const [namespace, chainId] = caipAccount.split(':');
  return `${namespace}:${chainId}`;
};

/**
 * Parses an AztecAddress from a CAIP account string.
 * CAIP format: aztec:chainId:address (e.g., "aztec:testnet:0x1234...")
 *
 * Handles both:
 * - Full CAIP format: "aztec:chainId:0x..."
 * - Plain address: "0x..."
 * - Aztec addresses (66 chars) and Ethereum addresses (42 chars, padded)
 *
 * @param caipAccount - The CAIP account string or plain address
 * @returns The parsed AztecAddress
 */
export const parseAddressFromCaip = (caipAccount: string): AztecAddress => {
  const parts = caipAccount.split(':');
  const hasPrefix = parts.length === 3 && parts[0] === 'aztec';
  const addressStr = hasPrefix ? parts[2] : caipAccount;

  // Handle Aztec address format (66 chars: 0x + 64 hex)
  if (addressStr.length === 66) {
    return AztecAddress.fromString(addressStr);
  }

  // Handle Ethereum address format (42 chars: 0x + 40 hex) - pad to Aztec format
  if (addressStr.length === 42) {
    const paddedAddress = '0x' + addressStr.slice(2).padStart(64, '0');
    return AztecAddress.fromString(paddedAddress);
  }

  throw new Error(`Unsupported account format: ${caipAccount}`);
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
      artifact: normalizeArtifactForAzguard(definition.artifact),
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
    artifact: normalizeArtifactForAzguard(SponsoredFPCContractArtifact),
  });

  return operations;
};
