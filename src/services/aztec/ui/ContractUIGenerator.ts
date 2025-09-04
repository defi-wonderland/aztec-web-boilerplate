import { 
  AztecContractMetadata, 
  AztecContractFunction, 
  AztecFunctionParameter,
  AztecParameterType 
} from '../../../types';

/**
 * UI component configuration for contract functions
 */
export interface FunctionUIConfig {
  /** Function metadata */
  function: AztecContractFunction;
  /** Generated input fields configuration */
  inputFields: InputFieldConfig[];
  /** Display configuration */
  display: {
    title: string;
    description?: string;
    category: 'initializer' | 'private' | 'public' | 'unconstrained';
    icon: string;
    color: string;
  };
  /** Validation rules */
  validation: ValidationConfig;
}

/**
 * Input field configuration for function parameters
 */
export interface InputFieldConfig {
  /** Parameter metadata */
  parameter: AztecFunctionParameter;
  /** Field properties */
  field: {
    id: string;
    name: string;
    label: string;
    type: InputFieldType;
    placeholder: string;
    helpText?: string;
  };
  /** Validation rules */
  validation: {
    required: boolean;
    pattern?: string;
    min?: number;
    max?: number;
    custom?: string[];
  };
}

/**
 * UI input field types
 */
export type InputFieldType = 
  | 'text'
  | 'number'
  | 'bigint'
  | 'address'
  | 'boolean'
  | 'array'
  | 'object'
  | 'textarea';

/**
 * Validation configuration for entire function
 */
export interface ValidationConfig {
  /** Whether all fields are valid */
  hasRequiredFields: boolean;
  /** Custom validation messages */
  messages: Record<string, string>;
  /** Validation patterns */
  patterns: Record<string, RegExp>;
}

/**
 * Contract UI configuration
 */
export interface ContractUIConfig {
  /** Contract metadata */
  metadata: AztecContractMetadata;
  /** Generated function UIs */
  functions: FunctionUIConfig[];
  /** Categorized functions */
  categories: {
    initializers: FunctionUIConfig[];
    private: FunctionUIConfig[];
    public: FunctionUIConfig[];
    unconstrained: FunctionUIConfig[];
  };
  /** Overall validation */
  validation: {
    hasInitializers: boolean;
    initializerCount: number;
    totalFunctions: number;
    supportedFunctions: number;
  };
}

/**
 * Service for generating UI configurations from Aztec contract metadata
 * 
 * This service takes parsed contract metadata and generates React-friendly
 * UI configurations that can be used to dynamically create contract
 * interaction interfaces.
 * 
 * @example
 * ```typescript
 * const generator = new ContractUIGenerator();
 * const artifactService = new AztecArtifactService();
 * 
 * const metadata = artifactService.parseArtifact(contractArtifact);
 * const uiConfig = generator.generateContractUI(metadata);
 * 
 * // Use uiConfig to render dynamic UI components
 * ```
 */
export class ContractUIGenerator {
  /**
   * Generate complete UI configuration for a contract
   * 
   * @param metadata - Parsed contract metadata
   * @returns Complete UI configuration for the contract
   */
  generateContractUI(metadata: AztecContractMetadata): ContractUIConfig {
    const functionConfigs = metadata.functions.map(fn => this.generateFunctionUI(fn));
    
    return {
      metadata,
      functions: functionConfigs,
      categories: this.categorizeFunctions(functionConfigs),
      validation: this.generateContractValidation(metadata, functionConfigs),
    };
  }

  /**
   * Generate UI configuration for a single function
   * 
   * @param functionDef - Function metadata
   * @returns UI configuration for the function
   */
  generateFunctionUI(functionDef: AztecContractFunction): FunctionUIConfig {
    const inputFields = functionDef.parameters.map(param => 
      this.generateInputField(param, functionDef.name)
    );
    
    return {
      function: functionDef,
      inputFields,
      display: this.generateDisplayConfig(functionDef),
      validation: this.generateValidationConfig(functionDef, inputFields),
    };
  }

  /**
   * Generate input field configuration for a parameter
   * 
   * @param parameter - Function parameter metadata
   * @param functionName - Name of the parent function
   * @returns Input field configuration
   */
  generateInputField(parameter: AztecFunctionParameter, functionName: string): InputFieldConfig {
    const fieldId = `${functionName}_${parameter.name}`;
    const fieldType = this.mapParameterTypeToInputType(parameter.type);
    
    return {
      parameter,
      field: {
        id: fieldId,
        name: parameter.name,
        label: this.generateFieldLabel(parameter),
        type: fieldType,
        placeholder: this.generatePlaceholder(parameter),
        helpText: this.generateHelpText(parameter),
      },
      validation: this.generateFieldValidation(parameter),
    };
  }

  /**
   * Generate display configuration for a function
   * 
   * @param functionDef - Function metadata
   * @returns Display configuration
   * @private
   */
  private generateDisplayConfig(functionDef: AztecContractFunction): FunctionUIConfig['display'] {
    const category = this.determineFunctionCategory(functionDef);
    
    return {
      title: this.formatFunctionTitle(functionDef.name),
      description: this.generateFunctionDescription(functionDef),
      category,
      icon: this.getFunctionIcon(category),
      color: this.getFunctionColor(category),
    };
  }

  /**
   * Generate validation configuration for a function
   * 
   * @param functionDef - Function metadata
   * @param inputFields - Generated input fields
   * @returns Validation configuration
   * @private
   */
  private generateValidationConfig(
    functionDef: AztecContractFunction, 
    inputFields: InputFieldConfig[]
  ): ValidationConfig {
    const hasRequiredFields = inputFields.some(field => field.validation.required);
    
    return {
      hasRequiredFields,
      messages: this.generateValidationMessages(functionDef),
      patterns: this.generateValidationPatterns(inputFields),
    };
  }

  /**
   * Map Aztec parameter types to UI input types
   * 
   * @param paramType - Aztec parameter type
   * @returns UI input field type
   * @private
   */
  private mapParameterTypeToInputType(paramType: AztecParameterType): InputFieldType {
    switch (paramType) {
      case 'Field':
      case 'AztecAddress':
      case 'PublicKey':
      case 'Signature':
      case 'NoteHash':
      case 'Nullifier':
        return 'address';
      
      case 'bool':
        return 'boolean';
      
      case 'u8':
      case 'u16':
      case 'u32':
      case 'i8':
      case 'i16':
      case 'i32':
        return 'number';
      
      case 'u64':
      case 'u128':
      case 'i64':
      case 'i128':
        return 'bigint';
      
      case 'string':
        return 'textarea';
      
      case 'array':
        return 'array';
      
      case 'struct':
        return 'object';
      
      default:
        return 'text';
    }
  }

  /**
   * Generate human-readable field label
   * 
   * @param parameter - Function parameter
   * @returns Formatted label
   * @private
   */
  private generateFieldLabel(parameter: AztecFunctionParameter): string {
    // Convert snake_case to Title Case
    return parameter.name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate placeholder text for input fields
   * 
   * @param parameter - Function parameter
   * @returns Placeholder text
   * @private
   */
  private generatePlaceholder(parameter: AztecFunctionParameter): string {
    switch (parameter.type) {
      case 'Field':
        return 'Enter field value (0x...)';
      case 'AztecAddress':
        return 'Enter Aztec address (0x...)';
      case 'u64':
      case 'u128':
        return 'Enter positive number';
      case 'i64':
      case 'i128':
        return 'Enter number';
      case 'bool':
        return 'Select true or false';
      case 'string':
        return 'Enter text';
      case 'array':
        return 'Enter comma-separated values';
      case 'struct':
        return 'Enter object properties';
      default:
        return `Enter ${parameter.name}`;
    }
  }

  /**
   * Generate help text for parameters
   * 
   * @param parameter - Function parameter
   * @returns Help text
   * @private
   */
  private generateHelpText(parameter: AztecFunctionParameter): string | undefined {
    if (parameter.description) {
      return parameter.description;
    }

    switch (parameter.type) {
      case 'AztecAddress':
        return 'Aztec address format: 0x followed by 64 hexadecimal characters';
      case 'Field':
        return 'Field element in hexadecimal format';
      case 'struct':
        return 'Complex object - expand to see individual fields';
      case 'array':
        return 'Multiple values separated by commas';
      default:
        return undefined;
    }
  }

  /**
   * Generate field-level validation rules
   * 
   * @param parameter - Function parameter
   * @returns Validation configuration
   * @private
   */
  private generateFieldValidation(parameter: AztecFunctionParameter): InputFieldConfig['validation'] {
    const validation: InputFieldConfig['validation'] = {
      required: parameter.required,
    };

    switch (parameter.type) {
      case 'AztecAddress':
      case 'Field':
        validation.pattern = '^0x[a-fA-F0-9]{64}$';
        break;
      
      case 'u8':
        validation.min = 0;
        validation.max = 255;
        break;
      
      case 'u16':
        validation.min = 0;
        validation.max = 65535;
        break;
      
      case 'u32':
        validation.min = 0;
        validation.max = 4294967295;
        break;
      
      case 'i8':
        validation.min = -128;
        validation.max = 127;
        break;
      
      case 'i16':
        validation.min = -32768;
        validation.max = 32767;
        break;
      
      case 'i32':
        validation.min = -2147483648;
        validation.max = 2147483647;
        break;
    }

    return validation;
  }

  /**
   * Categorize functions by type
   * 
   * @param functionConfigs - All function configurations
   * @returns Categorized functions
   * @private
   */
  private categorizeFunctions(functionConfigs: FunctionUIConfig[]): ContractUIConfig['categories'] {
    const categories: ContractUIConfig['categories'] = {
      initializers: [],
      private: [],
      public: [],
      unconstrained: [],
    };

    for (const config of functionConfigs) {
      if (config.function.isInitializer) {
        categories.initializers.push(config);
      } else {
        categories[config.function.visibility].push(config);
      }
    }

    return categories;
  }

  /**
   * Determine function category for display
   * 
   * @param functionDef - Function definition
   * @returns Function category
   * @private
   */
  private determineFunctionCategory(functionDef: AztecContractFunction): FunctionUIConfig['display']['category'] {
    if (functionDef.isInitializer) return 'initializer';
    return functionDef.visibility;
  }

  /**
   * Get icon for function category
   * 
   * @param category - Function category
   * @returns Icon identifier
   * @private
   */
  private getFunctionIcon(category: FunctionUIConfig['display']['category']): string {
    switch (category) {
      case 'initializer': return '🚀';
      case 'private': return '🔒';
      case 'public': return '🌐';
      case 'unconstrained': return '⚡';
      default: return '⚙️';
    }
  }

  /**
   * Get color for function category
   * 
   * @param category - Function category
   * @returns CSS color value
   * @private
   */
  private getFunctionColor(category: FunctionUIConfig['display']['category']): string {
    switch (category) {
      case 'initializer': return '#f59e0b';
      case 'private': return '#8b5cf6';
      case 'public': return '#3b82f6';
      case 'unconstrained': return '#10b981';
      default: return '#6b7280';
    }
  }

  /**
   * Format function name for display
   * 
   * @param functionName - Raw function name
   * @returns Formatted title
   * @private
   */
  private formatFunctionTitle(functionName: string): string {
    return functionName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate function description
   * 
   * @param functionDef - Function definition
   * @returns Generated description
   * @private
   */
  private generateFunctionDescription(functionDef: AztecContractFunction): string {
    const visibility = functionDef.visibility;
    const paramCount = functionDef.parameters.length;
    
    if (functionDef.isInitializer) {
      return `Initialize the contract${paramCount > 0 ? ` with ${paramCount} parameter${paramCount > 1 ? 's' : ''}` : ''}`;
    }

    const visibilityDesc = {
      private: 'Execute privately',
      public: 'Execute publicly',
      unconstrained: 'View/query function',
    }[visibility] || 'Execute function';

    return `${visibilityDesc}${paramCount > 0 ? ` - requires ${paramCount} parameter${paramCount > 1 ? 's' : ''}` : ''}`;
  }

  /**
   * Generate validation messages for a function
   * 
   * @param functionDef - Function definition
   * @returns Validation messages
   * @private
   */
  private generateValidationMessages(functionDef: AztecContractFunction): Record<string, string> {
    return {
      required: `${this.formatFunctionTitle(functionDef.name)} requires all fields to be filled`,
      invalid: `Please check your input values for ${functionDef.name}`,
      execution: `Failed to execute ${functionDef.name} - please try again`,
    };
  }

  /**
   * Generate validation patterns for input fields
   * 
   * @param inputFields - Generated input fields
   * @returns Validation patterns
   * @private
   */
  private generateValidationPatterns(inputFields: InputFieldConfig[]): Record<string, RegExp> {
    const patterns: Record<string, RegExp> = {};
    
    for (const field of inputFields) {
      if (field.validation.pattern) {
        patterns[field.field.id] = new RegExp(field.validation.pattern);
      }
    }
    
    return patterns;
  }

  /**
   * Generate contract-level validation
   * 
   * @param metadata - Contract metadata
   * @param functionConfigs - Function configurations
   * @returns Contract validation info
   * @private
   */
  private generateContractValidation(
    metadata: AztecContractMetadata, 
    functionConfigs: FunctionUIConfig[]
  ): ContractUIConfig['validation'] {
    const initializerCount = metadata.initializers.length;
    return {
      hasInitializers: initializerCount > 0,
      initializerCount,
      totalFunctions: metadata.functions.length,
      supportedFunctions: functionConfigs.length,
    };
  }
}
