import { type PXE, type AccountWallet, type Fr, type ContractFunctionInteraction, type AztecAddress, type ContractInstanceWithAddress } from '@aztec/aztec.js';
import { FunctionAbi, type ContractArtifact } from '@aztec/stdlib/abi';
import { type SponsoredFeePaymentMethod } from '@aztec/aztec.js';

// ============================================================================
// STORAGE SERVICE INTERFACES
// ============================================================================

export interface AccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
}

export interface IAztecStorageService {
  saveAccount(accountData: AccountData): void;
  getAccount(): AccountData | null;
  clearAccount(): void;
}

// ============================================================================
// WALLET SERVICE INTERFACES
// ============================================================================

export interface CreateAccountResult {
  account: any; // TODO: Type this properly when we know the exact type
  wallet: AccountWallet;
  salt: Fr;
  secretKey: Fr;
  signingKey: Buffer; // Node.js Buffer type
}

export interface IAztecWalletService {
  // Core initialization
  initialize(nodeUrl: string): Promise<void>;
  
  // PXE access
  getPXE(): PXE;
  
  // Account management
  connectTestAccount(index: number): Promise<AccountWallet>;
  createEcdsaAccount(deploy: boolean): Promise<CreateAccountResult>;
  createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<AccountWallet>;
  
  // Payment methods (public API)
  getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod>;
}

// ============================================================================
// CONTRACT SERVICE INTERFACES
// ============================================================================

export interface IAztecContractService {
  registerContract(
    artifact: ContractArtifact,
    deployer: AztecAddress,
    deploymentSalt: Fr,
    constructorArgs?: any[],
    constructor?: FunctionAbi | string
  ): Promise<ContractInstanceWithAddress>;
}

// ============================================================================
// VOTING SERVICE INTERFACES
// ============================================================================

export interface IAztecVotingService {
  castVote(candidateId: number): Promise<void>;
  getVoteCount(candidateId: number): Promise<number>;
  getAllVoteCounts(): Promise<{ [key: number]: number }>;
}

// ============================================================================
// DRIPPER SERVICE INTERFACES
// ============================================================================

export interface IDripperService {
  dripToPrivate(tokenAddress: string, amount: bigint): Promise<void>;
  dripToPublic(tokenAddress: string, amount: bigint): Promise<void>;
  syncPrivateState(): Promise<void>;
}
