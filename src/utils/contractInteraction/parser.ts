import {
  ContractArtifact,
  loadContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import {
  normalizeFunction,
  hasProcessedFunctions,
  type RawParamType,
  type RawParameter,
} from '../artifactNormalizer';
import { ArtifactErrorFactory } from '../errors';
import { getKnownStructKind } from '../knownStructTypes';
import type {
  ParsedType,
  ParsedField,
  ParsedFunction,
  ParsedArtifact,
} from '../../types/artifact';

const normalizeType = (type: RawParamType): ParsedType => {
  if (type.kind === 'struct' && type.path) {
    const knownKind = getKnownStructKind(type.path);
    if (knownKind) {
      return { kind: knownKind, path: type.path } as ParsedType;
    }
  }

  switch (type.kind) {
    case 'field':
      return { kind: 'field' };
    case 'boolean':
      return { kind: 'boolean' };
    case 'string':
      return { kind: 'string' };
    case 'integer':
      return {
        kind: 'integer',
        sign: type.sign ?? 'unsigned',
        width: type.width ?? 0,
      };
    case 'array':
      return {
        kind: 'array',
        length: type.length,
        type: type.type ? normalizeType(type.type) : { kind: 'field' },
      };
    case 'struct':
      return {
        kind: 'struct',
        path: type.path,
        fields: (type.fields ?? []).map((field) => ({
          path: field.name,
          label: field.name,
          type: normalizeType(field.type),
        })),
      };
    default:
      return { kind: 'string' };
  }
};

const flattenFields = (
  fields: ParsedField[],
  parentPath?: string
): ParsedField[] => {
  const flat: ParsedField[] = [];

  for (const field of fields) {
    const currentPath = parentPath ? `${parentPath}.${field.path}` : field.path;
    const entry: ParsedField = {
      ...field,
      path: currentPath,
    };

    flat.push(entry);

    if (field.type.kind === 'struct') {
      const nested = flattenFields(
        field.type.fields.map((nestedField) => ({
          ...nestedField,
          path: nestedField.path,
        })),
        currentPath
      );
      flat.push(...nested);
    }
  }

  return flat;
};

/**
 * Checks if a parameter is a system context input that should be filtered out.
 */
const isSystemContextParam = (param: RawParameter): boolean => {
  const path = (param.type.path ?? '').toLowerCase();
  return (
    param.name === 'inputs' &&
    (path.includes('private_context_inputs') ||
      path.includes('public_context_inputs'))
  );
};

/**
 * Parses a function from any supported artifact format into ParsedFunction.
 * Handles both raw NoirCompiledContract and processed ContractArtifact formats.
 */
const parseFunction = (fn: unknown): ParsedFunction => {
  const normalized = normalizeFunction(fn);

  const filteredParams = normalized.parameters.filter(
    (param) => !isSystemContextParam(param)
  );

  const inputs = filteredParams.map<ParsedField>((param) => ({
    path: param.name,
    label: param.name,
    type: normalizeType(param.type),
    visibility: param.visibility,
  }));

  return {
    name: normalized.name,
    inputs: flattenFields(inputs),
    attributes: normalized.attributes,
    isUnconstrained: normalized.isUnconstrained,
  };
};

/**
 * Extracts all functions from an artifact, handling both formats.
 * ContractArtifact splits functions into `functions` and `nonDispatchPublicFunctions`,
 * while NoirCompiledContract has all functions in a single `functions` array.
 */
const extractAllFunctions = (
  artifact: Record<string, unknown>,
  isProcessedFormat: boolean
): unknown[] => {
  const mainFunctions = Array.isArray(artifact.functions)
    ? artifact.functions
    : [];

  if (!isProcessedFormat) {
    return mainFunctions;
  }

  // ContractArtifact format: merge functions and nonDispatchPublicFunctions
  const publicFunctions = Array.isArray(artifact.nonDispatchPublicFunctions)
    ? artifact.nonDispatchPublicFunctions
    : [];

  return [...mainFunctions, ...publicFunctions];
};

/**
 * Parses artifact JSON source into a structured ParsedArtifact.
 * Supports both artifact formats:
 * - NoirCompiledContract (raw from compiler/local builds)
 * - ContractArtifact (processed from registry)
 * @throws {ArtifactError} When JSON is invalid or artifact structure is malformed
 */
export const parseArtifactSource = (source: string): ParsedArtifact => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(source) as Record<string, unknown>;
  } catch (err) {
    throw ArtifactErrorFactory.invalidJson(err);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw ArtifactErrorFactory.invalidStructure();
  }

  if (!Array.isArray(parsed.functions)) {
    throw ArtifactErrorFactory.missingFunctions();
  }

  const isProcessedFormat = hasProcessedFunctions(parsed);
  const allFunctions = extractAllFunctions(parsed, isProcessedFormat);
  const functions = allFunctions.map(parseFunction);

  if (isProcessedFormat) {
    // ContractArtifact format (from registry) - already processed
    const artifact = parsed as unknown as ContractArtifact;
    return {
      // Cast to NoirCompiledContract for type compatibility
      // The structure is similar enough for downstream usage (name, address extraction)
      compiled: parsed as unknown as NoirCompiledContract,
      artifact,
      functions,
      discoveredAddress: parsed.address as string | undefined,
    };
  }

  // NoirCompiledContract format (raw from compiler) - needs processing
  const compiled = parsed as unknown as NoirCompiledContract;
  const artifact = loadContractArtifact(compiled);

  return {
    compiled,
    artifact,
    functions,
    discoveredAddress: parsed.address as string | undefined,
  };
};
