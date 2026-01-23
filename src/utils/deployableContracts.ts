import {
  parseArtifactSource,
  type ParsedFunction,
} from './contractInteraction';
import { toTitleCase } from './string';
import type { AztecNetwork } from '../config/networks/constants';

export type DeployableContractConfig = {
  id: string;
  label: string;
  network?: AztecNetwork;
  /** Optional field name to use as the display label in saved contracts. */
  labelField?: string;
} & (
  | { artifact: unknown; classId?: never }
  | { artifact?: never; classId: string }
);

/**
 * Constructor definition - extends ParsedFunction with a friendly label.
 */
export type ContractConstructor = ParsedFunction & {
  /** Human-friendly label for the constructor */
  label: string;
};

/**
 * Fully processed deployable contract with extracted constructors.
 * For registry-based contracts, artifactJson and constructors may be empty
 * until resolved via ArtifactRegistryService.
 */
export type DeployableContract = {
  id: string;
  label: string;
  artifactJson?: string;
  constructors: ContractConstructor[];
  network?: AztecNetwork;
  labelField?: string;
  /** Class ID to fetch artifact from registry */
  classId?: string;
};

/**
 * Build a friendly label from a constructor function name.
 */
const buildConstructorLabel = (name: string): string => {
  const labelPart = name
    .replace(/^constructor_?/, '')
    .replace(/_/g, ' ')
    .trim();
  return labelPart ? toTitleCase(labelPart) : 'Default';
};

type RegistryParameter = {
  name: string;
  type: {
    kind: string;
    path?: string;
    fields?: Array<{ name: string; type: unknown }>;
    [key: string]: unknown;
  };
  visibility?: string;
};

type RegistryFunction = {
  name: string;
  isInitializer?: boolean;
  parameters?: RegistryParameter[];
};

type FlattenedInput = ParsedFunction['inputs'][number];

/**
 * Known struct paths that should be converted to primitive types.
 * These are not flattened - they're treated as single input fields.
 */
const KNOWN_STRUCT_KINDS: Record<string, string> = {
  'aztec::protocol_types::address::aztec_address::AztecAddress': 'address',
  'aztec::protocol_types::address::eth_address::EthAddress': 'eth_address',
  'aztec::protocol_types::abis::function_selector::FunctionSelector':
    'selector',
  'compressed_string::field_compressed_string::FieldCompressedString':
    'compressed_string',
};

/**
 * Normalize a registry parameter type, converting known structs to primitive kinds.
 */
const normalizeRegistryType = (
  type: RegistryParameter['type']
): FlattenedInput['type'] => {
  // Check for known struct types (like AztecAddress)
  if (type.kind === 'struct' && type.path) {
    const knownKind = KNOWN_STRUCT_KINDS[type.path];
    if (knownKind) {
      return { kind: knownKind, path: type.path } as FlattenedInput['type'];
    }
  }

  // For unknown structs, normalize fields with path property
  if (type.kind === 'struct' && Array.isArray(type.fields)) {
    return {
      ...type,
      fields: type.fields.map((field) => ({
        ...field,
        path: field.name,
        type: normalizeRegistryType(field.type as RegistryParameter['type']),
      })),
    } as FlattenedInput['type'];
  }

  return type as FlattenedInput['type'];
};

/**
 * Check if a struct type is a known type that shouldn't be flattened.
 */
const isKnownStructType = (type: RegistryParameter['type']): boolean => {
  return (
    type.kind === 'struct' &&
    typeof type.path === 'string' &&
    type.path in KNOWN_STRUCT_KINDS
  );
};

/**
 * Flatten struct parameters into individual fields for UI rendering.
 * Known struct types (AztecAddress, etc.) are NOT flattened - they become single inputs.
 * Unknown structs are flattened into their component fields.
 */
const flattenRegistryParameters = (
  params: RegistryParameter[],
  parentPath?: string,
  parentLabel?: string
): FlattenedInput[] => {
  const result: FlattenedInput[] = [];

  for (const param of params) {
    const currentPath = parentPath ? `${parentPath}.${param.name}` : param.name;
    const label = parentLabel ?? param.name;
    const normalizedType = normalizeRegistryType(param.type);

    result.push({
      path: currentPath,
      label,
      type: normalizedType,
      visibility: param.visibility as 'public' | 'private' | undefined,
    });

    // Only flatten unknown struct types (not AztecAddress, etc.)
    if (
      param.type.kind === 'struct' &&
      Array.isArray(param.type.fields) &&
      !isKnownStructType(param.type)
    ) {
      const nestedParams = param.type.fields.map((field) => ({
        name: field.name,
        type: field.type as RegistryParameter['type'],
        visibility: param.visibility,
      }));
      result.push(
        ...flattenRegistryParameters(nestedParams, currentPath, param.name)
      );
    }
  }

  return result;
};

/**
 * Extract constructors from ContractArtifact format (registry artifacts).
 * Constructors may be in `functions` or `nonDispatchPublicFunctions`.
 */
const extractFromContractArtifact = (artifact: {
  functions?: RegistryFunction[];
  nonDispatchPublicFunctions?: RegistryFunction[];
}): ContractConstructor[] => {
  const allFunctions = [
    ...(artifact.functions ?? []),
    ...(artifact.nonDispatchPublicFunctions ?? []),
  ];

  return allFunctions
    .filter((fn) => fn.isInitializer === true)
    .map((fn) => ({
      name: fn.name,
      inputs: flattenRegistryParameters(fn.parameters ?? []),
      attributes: ['abi_initializer'],
      isUnconstrained: false,
      label: buildConstructorLabel(fn.name),
    }));
};

/**
 * Extract constructors from NoirCompiledContract format (local artifacts).
 * Uses custom_attributes array with 'abi_initializer'.
 */
const extractFromCompiledContract = (
  artifactJson: string
): ContractConstructor[] => {
  const parsed = parseArtifactSource(artifactJson);
  return parsed.functions
    .filter((fn) => fn.attributes.includes('abi_initializer'))
    .map((fn) => ({
      ...fn,
      label: buildConstructorLabel(fn.name),
    }));
};

/**
 * Extract constructors from artifact JSON.
 * Handles both formats:
 * - NoirCompiledContract (local): custom_attributes with 'abi_initializer'
 * - ContractArtifact (registry): isInitializer boolean
 */
const extractConstructorsFromArtifact = (
  artifactJson: string
): ContractConstructor[] => {
  try {
    const raw = JSON.parse(artifactJson);

    // Detect format: ContractArtifact has functions with isInitializer boolean
    const firstFn = raw.functions?.[0];
    const isContractArtifact =
      firstFn && typeof firstFn.isInitializer === 'boolean';

    if (isContractArtifact) {
      return extractFromContractArtifact(raw);
    }

    return extractFromCompiledContract(artifactJson);
  } catch {
    return [];
  }
};

const createDeployableContract = (
  config: DeployableContractConfig
): DeployableContract => {
  if ('classId' in config && config.classId) {
    return {
      id: config.id,
      label: config.label,
      constructors: [],
      network: config.network,
      labelField: config.labelField,
      classId: config.classId,
    };
  }

  const artifactJson = JSON.stringify(config.artifact);
  const constructors = extractConstructorsFromArtifact(artifactJson);

  return {
    id: config.id,
    label: config.label,
    artifactJson,
    constructors,
    network: config.network,
    labelField: config.labelField,
  };
};

export const loadDeployableContracts = (
  configs: DeployableContractConfig[]
): DeployableContract[] => {
  return configs.map(createDeployableContract);
};

/**
 * Resolve a registry-based contract by providing the artifact.
 * Returns a fully hydrated DeployableContract with constructors.
 */
export const resolveDeployableContract = (
  contract: DeployableContract,
  artifact: unknown
): DeployableContract => {
  if (!contract.classId) {
    return contract;
  }

  const artifactJson = JSON.stringify(artifact);
  const constructors = extractConstructorsFromArtifact(artifactJson);

  return {
    ...contract,
    artifactJson,
    constructors,
  };
};

export const getDeployableContractsForNetwork = (
  contracts: DeployableContract[],
  networkName?: AztecNetwork
): DeployableContract[] => {
  if (!networkName) {
    return contracts;
  }
  return contracts.filter(
    (contract) => !contract.network || contract.network === networkName
  );
};

export const findDeployableContract = (
  contracts: DeployableContract[],
  contractId: string
): DeployableContract | undefined => {
  return contracts.find((contract) => contract.id === contractId);
};

export const findConstructor = (
  contract: DeployableContract,
  constructorName: string
): ContractConstructor | undefined => {
  return contract.constructors.find((c) => c.name === constructorName);
};

/**
 * Build a display label for a deployed contract using form values.
 * Uses explicit `labelField` from contract config if specified.
 */
export const buildDeploymentLabel = (
  contract: DeployableContract,
  formValues: Record<string, string>
): string => {
  const customValue = contract.labelField
    ? formValues[contract.labelField]?.trim()
    : null;

  // Extract base contract name (e.g., "Token Contract (Devnet)" -> "Token")
  const baseLabel = contract.label.split(' ')[0] ?? contract.label;

  if (customValue) {
    return `${baseLabel}: ${customValue}`;
  }

  return baseLabel;
};
