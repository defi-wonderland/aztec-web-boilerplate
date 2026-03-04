/**
 * App-level contract types.
 *
 * Re-exports all types from use-aztec and augments fee-payment-aware types
 * with the app-specific FeePaymentMethodType.
 */
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { ContractBase } from '@aztec/aztec.js/contracts';
import type { FeePaymentMethodType } from '../config/feePaymentContracts';
export type {
  MethodsOf,
  ArgsOf,
  ContractClassFor,
  ScopeKey,
  ContractQueryOptions,
  UseReadContractParams,
  WriteContractData,
  WriteContractCallOptions,
  UseWriteContractOptions,
  UseWriteContractReturn,
  ReadContractsContract,
  ReadContractResult,
  UseReadContractsParams,
} from '../use-aztec';
// Re-export use-aztec's WriteContractMutateParams and WriteContractActionParams
// but override feePaymentMethod with the app-specific FeePaymentMethodType
import type { MethodsOf, ArgsOf } from '../use-aztec';

/**
 * App-specific override of WriteContractMutateParams with typed fee payment.
 */
export interface WriteContractMutateParams<
  TContract extends ContractBase,
  TMethod extends MethodsOf<TContract>,
> {
  contract: {
    artifact: ContractArtifact;
    at: (...args: never[]) => Promise<TContract> | TContract;
  };
  address: string;
  functionName: TMethod;
  args: ArgsOf<TContract, TMethod>;
  feePaymentMethod?: FeePaymentMethodType;
  timeout?: number;
  receiptPolling?: { intervalMs?: number; maxAttempts?: number };
}

/**
 * App-specific override of WriteContractActionParams with typed fee payment.
 */
export interface WriteContractActionParams {
  contract: { artifact: ContractArtifact };
  address: string;
  functionName: string;
  args: readonly unknown[];
  feePaymentMethod?: FeePaymentMethodType;
  timeout?: number;
  receiptPolling?: { intervalMs?: number; maxAttempts?: number };
}
