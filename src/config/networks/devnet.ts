import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { NetworkConfig } from './types';

const isDev = import.meta.env.DEV;

/**
 * Devnet configuration for public development network.
 *
 * Contract addresses are hardcoded for the public devnet.
 * These contracts are already deployed and available for testing.
 *
 * Artifacts are fetched from the external registry using classIds.
 * Update classIds when contracts are redeployed with new class IDs.
 *
 * In development, requests are proxied through Vite to avoid CORS issues.
 */
export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  displayName: 'Devnet',
  description: 'Public development network for testing with real tokens',
  nodeUrl: 'https://next.devnet.aztec-labs.com/',
  dripperContractAddress:
    '0x02bc708c7f88a6bacefb7133eaf97a55d28980717c72bbd63d36d516536d9c21',
  tokenContractAddress:
    '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639',
  deployerAddress: AztecAddress.ZERO.toString(),
  dripperDeploymentSalt: 1337,
  tokenDeploymentSalt: 1337,
  proverEnabled: true,
  isTestnet: true,
  useExternalArtifactRegistry: true,
  artifactRegistryUrl: isDev
    ? '/artifact-registry'
    : 'https://devnet.aztec-registry.xyz',
  classIds: {
    dripper:
      '0x1d1014602e766124a9a52429708ed416708b39e3e6ad88fcbf7757af093062e5',
    token: '0x1a89e73869a0969d6a14a8eb2ad8c981820302ff64c55b1225fbe29e4bfa99aa',
  },
};
