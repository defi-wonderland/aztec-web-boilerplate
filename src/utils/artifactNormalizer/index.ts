/**
 * Artifact Format Normalizer
 *
 * Handles normalization between two distinct artifact formats:
 * 1. NoirCompiledContract (raw) - from local builds, user copy-paste
 * 2. ContractArtifact (processed) - from registry, loadContractArtifact()
 *
 * This module provides a unified interface for extracting function metadata
 * regardless of the source format.
 */

import { normalizeProcessedFunction, normalizeRawFunction } from './converters';
import { isProcessedFunction, isRawFunction } from './typeGuards';
import type { NormalizedFunctionData } from './types';

// =============================================================================
// Public API
// =============================================================================

/**
 * Normalizes a function from any supported format to the internal representation.
 * Automatically detects the format and applies the appropriate transformation.
 *
 * @param fn - Function object in either raw or processed format
 * @returns Normalized function data with consistent structure
 * @throws Error if the function format cannot be determined
 */
export const normalizeFunction = (fn: unknown): NormalizedFunctionData => {
  if (isProcessedFunction(fn)) {
    return normalizeProcessedFunction(fn);
  }

  if (isRawFunction(fn)) {
    return normalizeRawFunction(fn);
  }

  throw new Error(
    `Unknown function format: ${JSON.stringify(fn).slice(0, 100)}...`
  );
};

/**
 * Checks if an artifact contains processed (ContractArtifact) format functions.
 * ContractArtifact may have functions in `functions` and/or `nonDispatchPublicFunctions`.
 * Useful for determining which parsing strategy to use at the artifact level.
 */
export const hasProcessedFunctions = (artifact: {
  functions?: unknown[];
  nonDispatchPublicFunctions?: unknown[];
}): boolean => {
  const mainFunctions = artifact.functions ?? [];
  const publicFunctions = artifact.nonDispatchPublicFunctions ?? [];

  // Check first function from either array
  const firstFunction = mainFunctions[0] ?? publicFunctions[0];
  if (!firstFunction) return false;

  return isProcessedFunction(firstFunction);
};

// =============================================================================
// Re-exports
// =============================================================================

// Types
export type {
  RawParamType,
  RawParameter,
  RawFunction,
  FunctionType,
  ProcessedParamType,
  ProcessedParameter,
  ProcessedFunction,
  NormalizedFunctionData,
} from './types';

// Type guards
export { isProcessedFunction, isRawFunction } from './typeGuards';
