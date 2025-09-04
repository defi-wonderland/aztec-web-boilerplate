import { ContractArtifact, FunctionAbi } from '@aztec/stdlib/abi';
import { 
  AztecContractMetadata, 
  AztecContractFunction, 
  AztecFunctionParameter,
  AztecParameterType,
  AztecErrorType
} from '../../../types';

/**
 * Service for parsing and managing Aztec contract artifacts
 * 
 * This service handles the parsing of Aztec contract artifacts into structured
 * metadata that can be used for UI generation and contract interaction.
 * 
 * @example
 * ```typescript
 * const service = new AztecArtifactService();
 * const metadata = service.parseArtifact(contractArtifact);
 * const privateFunctions = service.getFunctionsByVisibility(metadata, 'private');
 * ```
 */
export class AztecArtifactService {
  /**
   * Parse a contract artifact into structured metadata
   * 
   * @param artifact - The Aztec contract artifact to parse
   * @returns Parsed contract metadata
   * @throws Error if artifact is invalid
   */
  parseArtifact(artifact: ContractArtifact): AztecContractMetadata {
    if (!this.validateArtifact(artifact)) {
      throw new Error(`Invalid contract artifact: missing required fields`);
    }

    const functions = artifact.functions.map(fn => this.extractFunctionMetadata(fn));
    
    return {
      name: artifact.name,
      noirVersion: artifact.noir_version || 'unknown',
      isTranspiled: Boolean(artifact.transpiled),
      functions,
      constructor: this.findConstructorFunction(functions),
      initializers: this.findInitializerFunctions(functions),
      privateFunctions: functions.filter(f => f.visibility === 'private'),
      publicFunctions: functions.filter(f => f.visibility === 'public'),
      unconstrainedFunctions: functions.filter(f => f.visibility === 'unconstrained'),
    };
  }

  /**
   * Validate that an artifact has required fields
   * 
   * @param artifact - Artifact to validate
   * @returns True if valid, false otherwise
   */
  validateArtifact(artifact: unknown): artifact is ContractArtifact {
    if (!artifact || typeof artifact !== 'object') {
      return false;
    }

    const typedArtifact = artifact as Partial<ContractArtifact>;

    return Boolean(
      typedArtifact.name &&
      typedArtifact.functions &&
      Array.isArray(typedArtifact.functions) &&
      typedArtifact.functions.length > 0
    );
  }

  /**
   * Extract metadata from a single function definition
   * 
   * @param functionDef - Raw function definition from artifact
   * @returns Structured function metadata
   */
  extractFunctionMetadata(functionDef: any): AztecContractFunction {
    const customAttributes = functionDef.custom_attributes || [];
    const isConstructor = functionDef.name === 'constructor';
    const isInitializer = customAttributes.includes('initializer');
    
    const visibility = this.determineVisibility(functionDef);
    const parameters = this.parseParameters(functionDef.abi?.parameters || []);
    const returnType = functionDef.abi?.return_type 
      ? this.parseParameterType(functionDef.abi.return_type)
      : null;
    const errorTypes = this.parseErrorTypes(functionDef.abi?.error_types || {});

    return {
      name: functionDef.name,
      visibility,
      abi: functionDef.abi,
      isConstructor,
      isInitializer,
      parameters,
      returnType,
      errorTypes,
    };
  }

  /**
   * Get functions filtered by visibility
   * 
   * @param metadata - Contract metadata
   * @param visibility - Visibility to filter by
   * @returns Array of functions with specified visibility
   */
  getFunctionsByVisibility(
    metadata: AztecContractMetadata, 
    visibility: 'private' | 'public' | 'unconstrained'
  ): AztecContractFunction[] {
    return metadata.functions.filter(fn => fn.visibility === visibility);
  }

  /**
   * Get the constructor function if it exists
   * 
   * @param metadata - Contract metadata
   * @returns Constructor function or undefined
   */
  getConstructorFunction(metadata: AztecContractMetadata): AztecContractFunction | undefined {
    return metadata.constructor;
  }

  /**
   * Parse parameter type from Aztec type definition
   * 
   * @param typeInfo - Type information from artifact
   * @returns Normalized parameter type
   */
  parseParameterType(typeInfo: any): AztecParameterType {
    if (!typeInfo || typeof typeInfo !== 'object') {
      return 'unknown';
    }

    // First check for Aztec-specific types by path regardless of kind
    if (typeInfo.path && typeof typeInfo.path === 'string') {
      if (typeInfo.path.includes('AztecAddress')) return 'AztecAddress';
      if (typeInfo.path.includes('PublicKey')) return 'PublicKey';
      if (typeInfo.path.includes('Signature')) return 'Signature';
      if (typeInfo.path.includes('NoteHash')) return 'NoteHash';
      if (typeInfo.path.includes('Nullifier')) return 'Nullifier';
    }

    switch (typeInfo.kind) {
      case 'field':
        return 'Field';
      
      case 'boolean':
        return 'bool';
      
      case 'integer':
        return this.parseIntegerType(typeInfo);
      
      case 'array':
        return 'array';
      
      case 'struct':
        return 'struct';
      
      case 'string':
        return 'string';
      
      default:
        return 'unknown';
    }
  }

  /**
   * Determine function visibility from function definition
   * 
   * @param functionDef - Raw function definition
   * @returns Function visibility
   * @private
   */
  private determineVisibility(functionDef: any): 'private' | 'public' | 'unconstrained' {
    const customAttributes = functionDef.custom_attributes || [];
    
    // Use is_unconstrained flag as primary determinant
    if (functionDef.is_unconstrained) {
      return 'unconstrained';
    }
    
    // For constrained functions, check custom attributes
    if (customAttributes.includes('private')) {
      return 'private';
    }
    
    if (customAttributes.includes('public')) {
      return 'public';
    }
    
    // Default to private for constrained functions
    return 'private';
  }

  /**
   * Parse function parameters
   * 
   * @param parameters - Raw parameter definitions
   * @returns Parsed parameter metadata
   * @private
   */
  private parseParameters(parameters: any[]): AztecFunctionParameter[] {
    if (!Array.isArray(parameters)) {
      return [];
    }

    return parameters.map((param, index) => ({
      name: param.name || `param${index}`,
      type: this.parseParameterType(param.type),
      required: true, // Aztec functions generally require all parameters
      description: param.description,
    }));
  }

  /**
   * Parse error types from function definition
   * 
   * @param errorTypes - Raw error type definitions
   * @returns Parsed error types
   * @private
   */
  private parseErrorTypes(errorTypes: Record<string, any>): Record<string, AztecErrorType> {
    const parsed: Record<string, AztecErrorType> = {};
    
    for (const [key, errorDef] of Object.entries(errorTypes)) {
      if (errorDef && typeof errorDef === 'object') {
        parsed[key] = {
          errorKind: errorDef.error_kind || 'unknown',
          string: errorDef.string,
          fields: errorDef.fields ? this.parseParameters(errorDef.fields) : undefined,
        };
      }
    }
    
    return parsed;
  }

  /**
   * Parse integer type with sign and width
   * 
   * @param typeInfo - Integer type information
   * @returns Formatted integer type string
   * @private
   */
  private parseIntegerType(typeInfo: any): AztecParameterType {
    const sign = typeInfo.sign || 'unsigned';
    const width = typeInfo.width || 32;
    
    const prefix = sign === 'signed' ? 'i' : 'u';
    
    switch (width) {
      case 8: return `${prefix}8` as AztecParameterType;
      case 16: return `${prefix}16` as AztecParameterType;
      case 32: return `${prefix}32` as AztecParameterType;
      case 64: return `${prefix}64` as AztecParameterType;
      case 128: return `${prefix}128` as AztecParameterType;
      default: return 'unknown';
    }
  }

  /**
   * Find constructor function in parsed functions
   * 
   * @param functions - Array of parsed functions
   * @returns Constructor function or undefined
   * @private
   */
  private findConstructorFunction(functions: AztecContractFunction[]): AztecContractFunction | undefined {
    return functions.find(fn => fn.isConstructor);
  }

  /**
   * Find initializer functions in parsed functions
   * 
   * @param functions - Array of parsed functions
   * @returns Array of initializer functions
   * @private
   */
  private findInitializerFunctions(functions: AztecContractFunction[]): AztecContractFunction[] {
    return functions.filter(fn => fn.isInitializer);
  }
}
