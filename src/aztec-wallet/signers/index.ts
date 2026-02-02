// Types
export type {
  ExternalSigner,
  ECDSAPublicKey,
  ExternalSignerFactory,
} from './types';
export { ExternalSignerType } from './types';

// EVMSigner
export { EVMSigner, createEVMSigner } from './EVMSigner';

// Auth witness provider
export { MetaMaskAuthWitnessProvider } from './MetaMaskAuthWitnessProvider';

// Account contract
export { EcdsaKEthSignerAccountContract } from './EcdsaKEthSignerAccountContract';

// Utils
export {
  recoverPublicKeyFromSignature,
  getPublicKeyRecoveryMessage,
} from './utils';
