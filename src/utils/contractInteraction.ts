import {
  loadContractArtifact,
  type ContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { EthAddress } from '@aztec/aztec.js/addresses';
import {
  normalizeFunction,
  hasProcessedFunctions,
  type RawParamType,
  type RawParameter,
} from './artifactNormalizer';
import { ArtifactParseError } from './errors';
import { getKnownStructKind } from './knownStructTypes';
import type { ArtifactError } from './errors';

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

export interface ParsedField {
  path: string;
  label: string;
  type: ParsedType;
  visibility?: string;
}

export interface ParsedFunction {
  name: string;
  inputs: ParsedField[];
  attributes: string[];
  isUnconstrained: boolean;
}

export interface ParsedArtifact {
  compiled: NoirCompiledContract;
  artifact: ContractArtifact;
  functions: ParsedFunction[];
  discoveredAddress?: string;
}

export interface ArtifactSummary {
  name: string;
  functionCount: number;
}

export const createArtifactSummary = (
  parsed: ParsedArtifact
): ArtifactSummary => ({
  name: (parsed.compiled as { name?: string })?.name ?? 'Contract',
  functionCount: parsed.functions.length,
});

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
 * @throws {ArtifactParseError} When JSON is invalid or artifact structure is malformed
 */
export const parseArtifactSource = (source: string): ParsedArtifact => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(source) as Record<string, unknown>;
  } catch (err) {
    throw ArtifactParseError.invalidJson(err);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw ArtifactParseError.invalidStructure();
  }

  if (!Array.isArray(parsed.functions)) {
    throw ArtifactParseError.missingFunctions();
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

const parseBoolean = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const parseArrayValue = (value: string): string[] => {
  if (!value.trim()) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const buildValue = (
  value: string,
  type: ParsedType,
  path: string,
  source: Record<string, string>
): { ok: true; value: unknown } | { ok: false; error: string } => {
  switch (type.kind) {
    case 'field':
    case 'integer': {
      if (value === '') {
        return { ok: false, error: `Missing value for ${path}` };
      }
      try {
        return { ok: true, value: BigInt(value) };
      } catch {
        return { ok: false, error: `Invalid integer for ${path}` };
      }
    }
    case 'boolean':
      return { ok: true, value: parseBoolean(value) };
    case 'string':
      return { ok: true, value };
    case 'address': {
      if (!value) {
        return { ok: false, error: `Missing address for ${path}` };
      }
      try {
        return { ok: true, value: AztecAddress.fromString(value) };
      } catch {
        return { ok: false, error: `Invalid Aztec address for ${path}` };
      }
    }
    case 'eth_address': {
      if (!value) {
        return { ok: false, error: `Missing ETH address for ${path}` };
      }
      try {
        return { ok: true, value: EthAddress.fromString(value) };
      } catch {
        return { ok: false, error: `Invalid ETH address for ${path}` };
      }
    }
    case 'selector': {
      if (!value) {
        return { ok: false, error: `Missing function selector for ${path}` };
      }
      // Function selector is a 4-byte hex value (u32)
      const normalized = value.startsWith('0x') ? value : `0x${value}`;
      try {
        const num = parseInt(normalized, 16);
        if (isNaN(num) || num < 0 || num > 0xffffffff) {
          return {
            ok: false,
            error: `Invalid function selector for ${path}: must be 4 bytes`,
          };
        }
        return { ok: true, value: num };
      } catch {
        return { ok: false, error: `Invalid function selector for ${path}` };
      }
    }
    case 'compressed_string': {
      // FieldCompressedString is used for token name/symbol
      // It stores a string as a single field element
      // The SDK handles the encoding, so we just pass the string
      return { ok: true, value };
    }
    case 'array': {
      const items = parseArrayValue(value);
      const parsedItems: unknown[] = [];
      for (const item of items) {
        const result = buildValue(item, type.type, path, source);
        if (!result.ok) {
          return result;
        }
        parsedItems.push(result.value);
      }
      return { ok: true, value: parsedItems };
    }
    case 'struct': {
      const structValue: Record<string, unknown> = {};
      for (const field of type.fields) {
        const fieldPath = `${path}.${field.path}`;
        const raw = source[fieldPath] ?? '';
        const result = buildValue(raw, field.type, fieldPath, source);
        if (!result.ok) {
          return result;
        }
        structValue[field.path] = result.value;
      }
      return { ok: true, value: structValue };
    }
    default:
      return { ok: true, value };
  }
};

type BuildResult = { ok: true; value: unknown } | { ok: false; error: string };

export const buildArgsFromInputs = (
  inputs: ParsedField[],
  formValues: Record<string, string>
): { args: unknown[]; errors: string[] } => {
  const errors: string[] = [];
  const args: unknown[] = [];

  const rootInputs = inputs.filter((input) => !input.path.includes('.'));

  for (const input of rootInputs) {
    const rawValue = formValues[input.path] ?? '';
    const result: BuildResult = buildValue(
      rawValue,
      input.type,
      input.path,
      formValues
    );

    if (result.ok === false) {
      errors.push(result.error);
      continue;
    }

    args.push(result.value);
  }

  return { args, errors };
};

export const formatFunctionSignature = (fn: ParsedFunction): string => {
  const params = fn.inputs
    .filter((input) => !input.path.includes('.'))
    .map((input) => input.label)
    .join(', ');
  return `${fn.name}(${params})`;
};

export const isValidAztecAddress = (value: string): boolean => {
  if (!value) return false;
  try {
    AztecAddress.fromString(value);
    return true;
  } catch {
    return false;
  }
};

export type FunctionCapabilities = {
  isPrivate: boolean;
  isPublic: boolean;
  isView: boolean;
  isUtility: boolean;
  isInitializer: boolean;
  isExecutable: boolean;
  canSimulate: boolean;
};

/**
 * Analyzes function attributes to determine its capabilities and visibility.
 */
export const analyzeFunctionCapabilities = (
  attributes: string[],
  inputs?: ParsedField[]
): FunctionCapabilities => {
  const hasAttr = (value: string): boolean => attributes.includes(value);

  const isView = hasAttr('abi_view');
  const isUtility = hasAttr('abi_utility');
  const isInitializer = hasAttr('abi_initializer');
  const attrHasPrivate = hasAttr('abi_private') || hasAttr('private');
  const attrHasPublic = hasAttr('abi_public') || hasAttr('public');

  const anyPrivateInput = Boolean(
    inputs?.some((input) => input.visibility === 'private')
  );
  const isPrivate = attrHasPrivate || (!attrHasPublic && anyPrivateInput);
  const isPublic = attrHasPublic;

  const isExecutable =
    (isPublic || attrHasPrivate) && !isView && !isInitializer;
  const canSimulate = isView || isUtility || !isExecutable;

  return {
    isPrivate,
    isPublic,
    isView,
    isUtility,
    isInitializer,
    isExecutable,
    canSimulate,
  };
};

export type CallValidationResult =
  | {
      valid: true;
      args: unknown[];
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Validates call prerequisites and builds arguments for contract execution.
 */
export const validateAndBuildCallArgs = (
  address: string,
  selectedFn: ParsedFunction | null,
  formValues: Record<string, string>
): CallValidationResult => {
  if (!selectedFn) {
    return { valid: false, error: 'No function selected' };
  }

  if (!isValidAztecAddress(address)) {
    return { valid: false, error: 'Provide a valid Aztec address.' };
  }

  const { args, errors } = buildArgsFromInputs(selectedFn.inputs, formValues);
  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true, args };
};

export type LoadArtifactResult =
  | {
      success: true;
      parsed: ParsedArtifact;
      address: string;
      contractLabel: string | undefined;
      shouldCacheInline: boolean;
      firstFunctionName: string | null;
    }
  | {
      success: false;
      error: ArtifactError;
    };

/**
 * Parses artifact source and prepares data for caching and state updates.
 * Pure function that extracts business logic from component.
 */
export const loadAndPrepareArtifact = (
  artifactInput: string,
  currentAddress: string,
  maxCacheChars: number
): LoadArtifactResult => {
  try {
    const parsed = parseArtifactSource(artifactInput);
    const discoveredAddress = (parsed.compiled as { address?: string }).address;
    const contractLabel = (parsed.compiled as { name?: string }).name;

    // Always prefer the user-supplied address (e.g., freshly deployed) over any
    // embedded address in the artifact to avoid pointing at a stale/prebuilt
    // instance.
    const address =
      (currentAddress &&
        isValidAztecAddress(currentAddress) &&
        currentAddress) ||
      (discoveredAddress && isValidAztecAddress(discoveredAddress)
        ? discoveredAddress
        : '');

    const shouldCacheInline = artifactInput.length <= maxCacheChars;
    const firstFunctionName = parsed.functions[0]?.name ?? null;

    return {
      success: true,
      parsed,
      address,
      contractLabel,
      shouldCacheInline,
      firstFunctionName,
    };
  } catch (err) {
    const error =
      err instanceof ArtifactParseError
        ? err
        : ArtifactParseError.invalidStructure(
            err instanceof Error ? err.message : 'Failed to parse artifact'
          );
    return { success: false, error };
  }
};

/**
 * Format contract call result data for display.
 * Handles BigInt conversion, compressed strings, and nested objects.
 */
export const formatResultData = (
  value: unknown,
  readCompressedString?: (field: { value: bigint }) => string
): unknown => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((v) => formatResultData(v, readCompressedString));
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);

    // Check for compressed string pattern: { value: bigint | string }
    if (
      readCompressedString &&
      entries.length === 1 &&
      entries[0][0] === 'value' &&
      (typeof entries[0][1] === 'string' || typeof entries[0][1] === 'bigint')
    ) {
      const fieldValue = entries[0][1];
      try {
        return readCompressedString({
          value: BigInt(fieldValue as string),
        });
      } catch {
        return fieldValue;
      }
    }

    const normalized: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      normalized[k] = formatResultData(v, readCompressedString);
    }
    return normalized;
  }

  return value;
};
