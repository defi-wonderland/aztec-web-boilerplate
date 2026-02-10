import type {
  ContractArtifact,
  NoirCompiledContract,
} from '@aztec/aztec.js/abi';

/**
 * Parsed representation of a contract parameter type.
 * Handles all Aztec-supported types including primitives, addresses, and complex types.
 */
export type ParsedType =
  | { kind: 'field' }
  | { kind: 'integer'; sign: 'unsigned' | 'signed'; width: number }
  | { kind: 'boolean' }
  | { kind: 'string' }
  | { kind: 'address'; path?: string }
  | { kind: 'eth_address'; path?: string }
  | { kind: 'selector'; path?: string }
  | { kind: 'compressed_string'; path?: string }
  | { kind: 'array'; length?: number; type: ParsedType }
  | { kind: 'struct'; path?: string; fields: ParsedField[] };

/**
 * Represents a single field/parameter in a contract function.
 */
export interface ParsedField {
  path: string;
  label: string;
  type: ParsedType;
  visibility?: string;
}

/**
 * Represents a parsed contract function with its inputs and attributes.
 */
export interface ParsedFunction {
  name: string;
  inputs: ParsedField[];
  attributes: string[];
  isUnconstrained: boolean;
}

/**
 * Complete parsed artifact containing compiled contract and extracted functions.
 */
export interface ParsedArtifact {
  compiled: NoirCompiledContract;
  artifact: ContractArtifact;
  functions: ParsedFunction[];
  discoveredAddress?: string;
}

/**
 * Lightweight summary of a contract artifact for display purposes.
 */
export interface ArtifactSummary {
  name: string;
  functionCount: number;
}
