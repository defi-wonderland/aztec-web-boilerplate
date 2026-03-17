import type { ContractBase } from '@aztec/aztec.js/contracts';
import type { ContractFunctionInteraction } from '@aztec/aztec.js/contracts';

type ContractMethod = (...args: unknown[]) => ContractFunctionInteraction;

/**
 * Gets a method from a contract instance by name.
 *
 * @param contract - The contract instance
 * @param methodName - The name of the method to retrieve
 * @returns The method function or undefined if not found
 */
export const getContractMethod = (
  contract: ContractBase,
  methodName: string
): ContractMethod | undefined => {
  const methods = contract.methods as
    | Record<string, ContractMethod>
    | undefined;
  return methods?.[methodName];
};
