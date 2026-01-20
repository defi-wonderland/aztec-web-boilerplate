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
  dripperPublicKeys: {
    masterNullifierPublicKey:
      '0x01498945581e0eb9f8427ad6021184c700ef091d570892c437d12c7d90364bbd170ae506787c5c43d6ca9255d571c10fa9ffa9d141666e290c347c5c9ab7e344',
    masterIncomingViewingPublicKey:
      '0x00c044b05b6ca83b9c2dbae79cc1135155956a64e136819136e9947fe5e5866c1c1f0ca244c7cd46b682552bff8ae77dea40b966a71de076ec3b7678f2bdb151',
    masterOutgoingViewingPublicKey:
      '0x1b00316144359e9a3ec8e49c1cdb7eeb0cedd190dfd9dc90eea5115aa779e287080ffc74d7a8b0bccb88ac11f45874172f3847eb8b92654aaa58a3d2b8dc7833',
    masterTaggingPublicKey:
      '0x019c111f36ad3fc1d9b7a7a14344314d2864b94f030594cd67f753ef774a1efb2039907fe37f08d10739255141bb066c506a12f7d1e8dfec21abc58494705b6f',
  },
  tokenContractAddress:
    '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639',
  tokenPublicKeys: {
    masterNullifierPublicKey:
      '0x01498945581e0eb9f8427ad6021184c700ef091d570892c437d12c7d90364bbd170ae506787c5c43d6ca9255d571c10fa9ffa9d141666e290c347c5c9ab7e344',
    masterIncomingViewingPublicKey:
      '0x00c044b05b6ca83b9c2dbae79cc1135155956a64e136819136e9947fe5e5866c1c1f0ca244c7cd46b682552bff8ae77dea40b966a71de076ec3b7678f2bdb151',
    masterOutgoingViewingPublicKey:
      '0x1b00316144359e9a3ec8e49c1cdb7eeb0cedd190dfd9dc90eea5115aa779e287080ffc74d7a8b0bccb88ac11f45874172f3847eb8b92654aaa58a3d2b8dc7833',
    masterTaggingPublicKey:
      '0x019c111f36ad3fc1d9b7a7a14344314d2864b94f030594cd67f753ef774a1efb2039907fe37f08d10739255141bb066c506a12f7d1e8dfec21abc58494705b6f',
  },
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
