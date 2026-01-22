import {
  loadContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import dripperSandboxJson from '../artifacts/sandbox/dripper-Dripper.json' with { type: 'json' };
import tokenSandboxJson from '../artifacts/sandbox/token_contract-Token.json' with { type: 'json' };
// TODO: Remove local devnet artifacts once registry has correct artifacts
// import dripperDevnetJson from '../artifacts/devnet/dripper-Dripper.json' with { type: 'json' };
// import tokenDevnetJson from '../artifacts/devnet/token_contract-Token.json' with { type: 'json' };
import { ArtifactRegistryService } from '../services/aztec/artifactRegistry';
import { DEVNET_CONFIG } from './networks/devnet';

/**
 * Network-specific artifact overrides.
 *
 * Some networks require pinned artifact versions that match the deployed contracts.
 * Add your contract artifacts here when connecting to networks with pre-deployed contracts.
 *
 * Keys are contract names (matching those in contracts.ts), values are artifacts.
 */
export type NetworkArtifactOverrides = Record<string, ContractArtifact>;

export const SANDBOX_ARTIFACTS: NetworkArtifactOverrides = {
  dripper: loadContractArtifact(dripperSandboxJson as NoirCompiledContract),
  token: loadContractArtifact(tokenSandboxJson as NoirCompiledContract),
};

// TODO: Remove local devnet artifacts once registry has correct artifacts
// export const DEVNET_LOCAL_ARTIFACTS: NetworkArtifactOverrides = {
//   dripper: loadContractArtifact(dripperDevnetJson as NoirCompiledContract),
//   token: loadContractArtifact(tokenDevnetJson as NoirCompiledContract),
// };

let devnetRegistryService: ArtifactRegistryService | null = null;

function getDevnetRegistryService(): ArtifactRegistryService {
  if (!devnetRegistryService) {
    const registryUrl = DEVNET_CONFIG.artifactRegistryUrl;
    if (!registryUrl) {
      throw new Error('Devnet artifact registry URL not configured');
    }
    devnetRegistryService = new ArtifactRegistryService(registryUrl);
  }
  return devnetRegistryService;
}

async function getDevnetArtifacts(): Promise<NetworkArtifactOverrides> {
  if (!DEVNET_CONFIG.useExternalArtifactRegistry) {
    throw new Error(
      '[NetworkArtifacts] External artifact registry is disabled but no local artifacts available'
    );
  }

  const classIds = DEVNET_CONFIG.classIds;
  if (!classIds || Object.keys(classIds).length === 0) {
    throw new Error('[NetworkArtifacts] Devnet classIds not configured');
  }

  const service = getDevnetRegistryService();
  const entries = Object.entries(classIds);

  const artifacts = await Promise.all(
    entries.map(([, classId]) => service.getArtifact(classId))
  );

  const result: NetworkArtifactOverrides = {};
  entries.forEach(([contractName], index) => {
    result[contractName] = artifacts[index];
  });

  return result;
}

export async function getNetworkArtifacts(
  networkName: string
): Promise<NetworkArtifactOverrides | undefined> {
  switch (networkName) {
    case 'devnet':
      return getDevnetArtifacts();
    case 'sandbox':
      return SANDBOX_ARTIFACTS;
    default:
      return undefined;
  }
}
