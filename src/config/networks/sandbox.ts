import { NetworkConfig } from './types';

export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: 'Local development environment with deterministic addresses',
  nodeUrl: 'http://localhost:8080',
  dripperContractAddress: '0x0f7e3955637264f90b6ff53962e82e6bb3316b0510db547733dcedbe568ba15e',
  tokenContractAddress: '0x02e90e4cd307dac2704528bbb9d2e76d6dd9a936e6891785bf381dfd1ac4a918',
  deployerAddress: '0x1fd78c1951acbd58735f62e6d1749813aaf0cd7292b53152f885d217874bfd70',
  dripperDeploymentSalt: '0x12842d541e59752276db3a782c76ae3f87d901070371655ed058bcc1b5247a26',
  tokenDeploymentSalt: '0x17bd7dee893bc73c245ee9242fff87444f36a6f4db9aaf4baa6633e7817d4f2d',
  proverEnabled: true,
  isTestnet: false,
};
