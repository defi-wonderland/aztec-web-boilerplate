import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  contractAddress: '0x0cd83011096a31e8fdfe2dabfca935257220233810fdf6c1e0684daf7b3676c2',
  dripperContractAddress: '0x2188f82c38703c445673eaafb0feedc3eac986739f16ef69a76d224bce622a67',
  tokenContractAddress: '0x073fe87f3edf29117e5d5f3a74703c5e9f817207cee02ff77c0901dcfb8ea889',
  deployerAddress: '0x014414369acafa52e60fe12d7d12e28a2486f5dc8dff6f268c8be42587e4d11d',
  deploymentSalt: '0x07a2d83204397c2b4ce5e32652817efdfaff326336481ce9377006b1629032ba',
  dripperDeploymentSalt: '0x153e14e9da3945227301bf0867f9991efb8ba045cd14651709a4b80027cc0073',
  tokenDeploymentSalt: '0x26b2058b4d5312b124c9f59191d1a750ec04f4aef0e5e931f6d72242369d2277',
  proverEnabled: true,
  isTestnet: false,
};
