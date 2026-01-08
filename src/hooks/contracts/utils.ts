import type { ContractFunctionInteraction } from '@aztec/aztec.js/contracts';

type ContractMethod = (...args: unknown[]) => ContractFunctionInteraction;

/**
 * Gets a method from a contract instance by name.
 * Provides type-safe access to contract methods without verbose casting.
 *
 * @param contract - The contract instance
 * @param methodName - The name of the method to retrieve
 * @returns The method function or undefined if not found
 */
export const getContractMethod = (
  contract: unknown,
  methodName: string
): ContractMethod | undefined => {
  const contractWithMethods = contract as {
    methods?: Record<string, ContractMethod>;
  };
  return contractWithMethods.methods?.[methodName];
};
