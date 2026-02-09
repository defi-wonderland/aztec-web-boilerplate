/**
 * Type guards for detecting artifact format.
 */

import type { ProcessedFunction, RawFunction } from './types';

/**
 * Checks if a function object is in the processed ContractArtifact format.
 * ContractArtifact functions have `functionType` enum instead of `is_unconstrained`.
 */
export const isProcessedFunction = (fn: unknown): fn is ProcessedFunction => {
  if (!fn || typeof fn !== 'object') return false;
  const obj = fn as Record<string, unknown>;
  return (
    'functionType' in obj &&
    typeof obj.functionType === 'string' &&
    ['private', 'public', 'utility'].includes(obj.functionType)
  );
};

/**
 * Checks if a function object is in the raw NoirCompiledContract format.
 * Raw functions have `custom_attributes` array and optional `is_unconstrained`.
 */
export const isRawFunction = (fn: unknown): fn is RawFunction => {
  if (!fn || typeof fn !== 'object') return false;
  const obj = fn as Record<string, unknown>;
  // Raw format either has custom_attributes or is_unconstrained (or neither for simple functions)
  // But it should NOT have functionType (which is the key differentiator)
  return !('functionType' in obj);
};
