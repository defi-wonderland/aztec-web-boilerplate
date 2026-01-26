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

// =============================================================================
// Type Definitions - Raw Format (NoirCompiledContract)
// =============================================================================

/**
 * Parameter type in raw NoirCompiledContract format.
 */
export type RawParamType = {
  kind: string;
  sign?: 'unsigned' | 'signed';
  width?: number;
  length?: number;
  path?: string;
  type?: RawParamType;
  fields?: Array<{ name: string; type: RawParamType }>;
};

/**
 * Parameter in raw NoirCompiledContract format.
 */
export type RawParameter = {
  name: string;
  type: RawParamType;
  visibility?: string;
};

/**
 * Function in raw NoirCompiledContract format (from Noir compiler output).
 */
export type RawFunction = {
  name: string;
  abi?: { parameters?: RawParameter[] };
  custom_attributes?: string[];
  is_unconstrained?: boolean;
};

// =============================================================================
// Type Definitions - Processed Format (ContractArtifact / FunctionAbi)
// =============================================================================

/**
 * Function type enum matching Aztec SDK's FunctionType.
 */
type FunctionType = 'private' | 'public' | 'utility';

/**
 * Parameter type in ContractArtifact format (ABIType).
 */
export type ProcessedParamType = {
  kind: string;
  sign?: 'unsigned' | 'signed';
  width?: number;
  length?: number;
  path?: string;
  type?: ProcessedParamType;
  fields?: Array<{ name: string; type: ProcessedParamType }>;
};

/**
 * Parameter in ContractArtifact format (ABIParameter).
 */
export type ProcessedParameter = {
  name: string;
  type: ProcessedParamType;
  visibility: 'private' | 'public';
};

/**
 * Function in ContractArtifact format (FunctionAbi from Aztec SDK).
 */
export type ProcessedFunction = {
  name: string;
  functionType: FunctionType;
  isInitializer: boolean;
  isStatic: boolean;
  parameters: ProcessedParameter[];
  returnTypes: ProcessedParamType[];
  errorTypes?: Record<string, unknown>;
};

// =============================================================================
// Type Definitions - Normalized Output
// =============================================================================

/**
 * Normalized function data extracted from either format.
 * This is the internal representation used throughout the app.
 */
export interface NormalizedFunctionData {
  name: string;
  parameters: RawParameter[];
  attributes: string[];
  isUnconstrained: boolean;
}

// =============================================================================
// Type Guards - Format Detection
// =============================================================================

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

// =============================================================================
// Attribute Reconstruction - ContractArtifact to Attributes
// =============================================================================

/**
 * Reconstructs the attributes array from ContractArtifact's processed properties.
 * This reverses what loadContractArtifact() does during compilation.
 */
const reconstructAttributes = (fn: ProcessedFunction): string[] => {
  const attributes: string[] = [];

  // Function type determines visibility attribute
  switch (fn.functionType) {
    case 'private':
      attributes.push('abi_private');
      break;
    case 'public':
      attributes.push('abi_public');
      break;
    case 'utility':
      attributes.push('abi_utility');
      break;
  }

  // Boolean flags map to specific attributes
  if (fn.isInitializer) {
    attributes.push('abi_initializer');
  }

  if (fn.isStatic) {
    attributes.push('abi_view');
  }

  return attributes;
};

/**
 * Determines if a function is unconstrained based on ContractArtifact properties.
 * Utility functions are unconstrained (they run on the client without proofs).
 */
const deriveIsUnconstrained = (fn: ProcessedFunction): boolean => {
  return fn.functionType === 'utility';
};

// =============================================================================
// Parameter Conversion - ContractArtifact to Raw Format
// =============================================================================

/**
 * Converts ProcessedParamType to RawParamType.
 * The structures are similar, but this ensures type compatibility.
 */
const convertParamType = (type: ProcessedParamType): RawParamType => {
  const result: RawParamType = { kind: type.kind };

  if (type.sign !== undefined) result.sign = type.sign;
  if (type.width !== undefined) result.width = type.width;
  if (type.length !== undefined) result.length = type.length;
  if (type.path !== undefined) result.path = type.path;
  if (type.type !== undefined) result.type = convertParamType(type.type);
  if (type.fields !== undefined) {
    result.fields = type.fields.map((f) => ({
      name: f.name,
      type: convertParamType(f.type),
    }));
  }

  return result;
};

/**
 * Converts ProcessedParameter to RawParameter format.
 */
const convertParameter = (param: ProcessedParameter): RawParameter => ({
  name: param.name,
  type: convertParamType(param.type),
  visibility: param.visibility,
});

// =============================================================================
// Normalizers - Format-Specific Extraction
// =============================================================================

/**
 * Normalizes a raw NoirCompiledContract function to the internal format.
 */
const normalizeRawFunction = (fn: RawFunction): NormalizedFunctionData => ({
  name: fn.name,
  parameters: fn.abi?.parameters ?? [],
  attributes: fn.custom_attributes ?? [],
  isUnconstrained: Boolean(fn.is_unconstrained),
});

/**
 * Normalizes a processed ContractArtifact function to the internal format.
 */
const normalizeProcessedFunction = (
  fn: ProcessedFunction
): NormalizedFunctionData => ({
  name: fn.name,
  parameters: fn.parameters.map(convertParameter),
  attributes: reconstructAttributes(fn),
  isUnconstrained: deriveIsUnconstrained(fn),
});

// =============================================================================
// Public API - Unified Normalizer
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
