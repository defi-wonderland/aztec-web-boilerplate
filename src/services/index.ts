// Re-export from aztec-wallet
export { AztecStorageService } from '../aztec-wallet/services/aztec';

export {
  EVMWalletService,
  getEVMWalletService,
  createEVMWalletService,
  type EVMWalletListener,
  type EVMWalletState,
} from '../aztec-wallet/services/evm';

export * from '../aztec-wallet/services/wallet';
