interface PatternLike {
  contract: string | { toString(): string };
  function: string;
}

/**
 * Check if a single ContractFunctionPattern matches a given contract + function.
 * Handles '*' wildcards for both contract and function.
 */
export function matchesPattern(
  pattern: PatternLike,
  contractAddress: string,
  functionName: string,
): boolean {
  const patternContract = typeof pattern.contract === 'string'
    ? pattern.contract
    : pattern.contract.toString();

  const contractMatch = patternContract === '*' || patternContract === contractAddress;
  const functionMatch = pattern.function === '*' || pattern.function === functionName;
  return contractMatch && functionMatch;
}

/**
 * Check if a scope (global '*' or pattern array) matches a contract + function.
 */
export function matchesScope(
  scope: '*' | PatternLike[],
  contractAddress: string,
  functionName: string,
): boolean {
  if (scope === '*') return true;
  return scope.some(p => matchesPattern(p, contractAddress, functionName));
}
