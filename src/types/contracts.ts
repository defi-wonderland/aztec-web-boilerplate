import { AztecAddress, Fr } from '@aztec/aztec.js';
import { ContractArtifact, FunctionAbi } from '@aztec/stdlib/abi';

/**
 * Represents a parsed Aztec contract function
 */
export interface AztecContractFunction {
  /** Function name */
  name: string;
  /** Function visibility (private/public/unconstrained) */
  visibility: 'private' | 'public' | 'unconstrained';
  /** Function ABI definition */
  abi: FunctionAbi;
  /** Whether function is a constructor */
  isConstructor: boolean;
  /** Whether function is an initializer */
  isInitializer: boolean;
  /** Function parameters with metadata */
  parameters: AztecFunctionParameter[];
  /** Return type information */
  returnType: AztecParameterType | null;
  /** Error types that can be thrown */
  errorTypes: Record<string, AztecErrorType>;
}

/**
 * Function parameter with type information
 */
export interface AztecFunctionParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: AztecParameterType;
  /** Whether parameter is required */
  required: boolean;
  /** Default value if any */
  defaultValue?: unknown;
  /** Parameter description from docs */
  description?: string;
}

/**
 * Aztec parameter types
 */
export type AztecParameterType = 
  | 'Field'
  | 'AztecAddress' 
  | 'bool'
  | 'u8' | 'u16' | 'u32' | 'u64' | 'u128'
  | 'i8' | 'i16' | 'i32' | 'i64' | 'i128'
  | 'array'
  | 'struct'
  | 'string'
  | 'PublicKey'
  | 'Signature'
  | 'NoteHash'
  | 'Nullifier'
  | 'unknown';

/**
 * Error type definition
 */
export interface AztecErrorType {
  /** Error kind (string, custom, etc.) */
  errorKind: string;
  /** Error message or custom type */
  string?: string;
  /** Custom error fields */
  fields?: AztecFunctionParameter[];
}

/**
 * Parsed contract metadata
 */
export interface AztecContractMetadata {
  /** Contract name */
  name: string;
  /** Contract address if deployed */
  address?: AztecAddress;
  /** Noir version used */
  noirVersion: string;
  /** Whether contract is transpiled */
  isTranspiled: boolean;
  /** All contract functions */
  functions: AztecContractFunction[];
  /** Constructor function */
  constructor?: AztecContractFunction;
  /** Initializer functions */
  initializers: AztecContractFunction[];
  /** Private functions */
  privateFunctions: AztecContractFunction[];
  /** Public functions */
  publicFunctions: AztecContractFunction[];
  /** Unconstrained functions */
  unconstrainedFunctions: AztecContractFunction[];
}

/**
 * Contract loading options
 */
export interface ContractLoadOptions {
  /** Contract address */
  address: AztecAddress;
  /** Contract artifact */
  artifact: ContractArtifact;
  /** Custom constructor arguments if needed */
  constructorArgs?: unknown[];
  /** Deployment salt if known */
  deploymentSalt?: Fr;
  /** Deployer address if known */
  deployerAddress?: AztecAddress;
}

/**
 * Function call parameters
 */
export interface FunctionCallParams {
  /** Function to call */
  functionName: string;
  /** Arguments to pass */
  args: unknown[];
  /** Gas limit (if applicable) */
  gasLimit?: number;
  /** Fee payment method */
  feePaymentMethod?: 'sponsored' | 'self';
}

/**
 * Function call result
 */
export interface FunctionCallResult {
  /** Whether call was successful */
  success: boolean;
  /** Transaction hash */
  txHash?: string;
  /** Return value */
  returnValue?: unknown;
  /** Error message if failed */
  error?: string;
  /** Gas used */
  gasUsed?: number;
  /** Proof generation time */
  proofTime?: number;
}

/**
 * Contract interaction history
 */
export interface ContractInteractionHistory {
  /** Unique interaction ID */
  id: string;
  /** Contract address */
  contractAddress: AztecAddress;
  /** Function called */
  functionName: string;
  /** Arguments used */
  args: unknown[];
  /** Result of the call */
  result: FunctionCallResult;
  /** Timestamp */
  timestamp: Date;
  /** Account that made the call */
  caller?: AztecAddress;
}
