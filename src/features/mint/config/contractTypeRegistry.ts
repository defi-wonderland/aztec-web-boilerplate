import type { ContractInstanceFromClass } from '@contract-registry';

type DripperContractClass =
  typeof import('@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js').DripperContract;
type TokenContractClass =
  typeof import('@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js').TokenContract;

declare module '@contract-registry/core/contractTypes' {
  interface ContractTypeRegistry {
    dripper: ContractInstanceFromClass<DripperContractClass>;
    token: ContractInstanceFromClass<TokenContractClass>;
  }
}

export {};
