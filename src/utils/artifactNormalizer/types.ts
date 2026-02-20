/**
 * Type definitions for artifact normalization.
 *
 * Handles two distinct artifact formats:
 * 1. NoirCompiledContract (raw) - from local builds, user copy-paste
 * 2. ContractArtifact (processed) - from registry, loadContractArtifact()
 */

// =============================================================================
// Raw Format Types (NoirCompiledContract)
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
  abi?: {
    parameters?: RawParameter[];
    return_type?: { abi_type?: RawParamType };
  };
  custom_attributes?: string[];
  is_unconstrained?: boolean;
};

// =============================================================================
// Processed Format Types (ContractArtifact / FunctionAbi)
// =============================================================================

/**
 * Function type enum matching Aztec SDK's FunctionType.
 */
export type FunctionType = 'private' | 'public' | 'utility';

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
// Normalized Output Types
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
  returnType: RawParamType | null;
}
