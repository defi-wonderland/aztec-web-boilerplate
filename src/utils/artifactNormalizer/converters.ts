/**
 * Converters for transforming between artifact formats.
 */

import type {
  ProcessedFunction,
  ProcessedParameter,
  ProcessedParamType,
  RawFunction,
  RawParameter,
  RawParamType,
  NormalizedFunctionData,
} from './types';

// =============================================================================
// Attribute Reconstruction - ContractArtifact to Attributes
// =============================================================================

/**
 * Reconstructs the attributes array from ContractArtifact's processed properties.
 * This reverses what loadContractArtifact() does during compilation.
 */
export const reconstructAttributes = (fn: ProcessedFunction): string[] => {
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
export const deriveIsUnconstrained = (fn: ProcessedFunction): boolean => {
  return fn.functionType === 'utility';
};

// =============================================================================
// Parameter Conversion - ContractArtifact to Raw Format
// =============================================================================

/**
 * Converts ProcessedParamType to RawParamType.
 * The structures are similar, but this ensures type compatibility.
 */
export const convertParamType = (type: ProcessedParamType): RawParamType => {
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
export const convertParameter = (param: ProcessedParameter): RawParameter => ({
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
export const normalizeRawFunction = (
  fn: RawFunction
): NormalizedFunctionData => ({
  name: fn.name,
  parameters: fn.abi?.parameters ?? [],
  attributes: fn.custom_attributes ?? [],
  isUnconstrained: Boolean(fn.is_unconstrained),
});

/**
 * Normalizes a processed ContractArtifact function to the internal format.
 */
export const normalizeProcessedFunction = (
  fn: ProcessedFunction
): NormalizedFunctionData => ({
  name: fn.name,
  parameters: fn.parameters.map(convertParameter),
  attributes: reconstructAttributes(fn),
  isUnconstrained: deriveIsUnconstrained(fn),
});
