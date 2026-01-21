import {
  loadContractArtifact,
  type ContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { EthAddress } from '@aztec/aztec.js/addresses';

type RawParamType = {
  kind: string;
  sign?: 'unsigned' | 'signed';
  width?: number;
  length?: number;
  path?: string;
  type?: RawParamType;
  fields?: Array<{ name: string; type: RawParamType }>;
};

type RawParameter = {
  name: string;
  type: RawParamType;
  visibility?: string;
};

type RawFunction = {
  name: string;
  abi?: { parameters?: RawParameter[] };
  custom_attributes?: string[];
  is_unconstrained?: boolean;
};

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

/**
 * Known Aztec struct paths normalized to primitive types.
 * See docs/contract-ui.md for detailed documentation.
 */
const KNOWN_STRUCT_PATHS: Record<string, ParsedType['kind']> = {
  'aztec::protocol_types::address::aztec_address::AztecAddress': 'address',
  'aztec::protocol_types::address::eth_address::EthAddress': 'eth_address',
  'aztec::protocol_types::abis::function_selector::FunctionSelector':
    'selector',
  'compressed_string::field_compressed_string::FieldCompressedString':
    'compressed_string',
};

const normalizeType = (type: RawParamType): ParsedType => {
  if (type.kind === 'struct' && type.path) {
    const knownKind = KNOWN_STRUCT_PATHS[type.path];
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

const parseFunction = (fn: RawFunction): ParsedFunction => {
  const isSystemContextParam = (param: RawParameter): boolean => {
    const path = (param.type.path ?? '').toLowerCase();
    return (
      param.name === 'inputs' &&
      (path.includes('private_context_inputs') ||
        path.includes('public_context_inputs'))
    );
  };

  const rawParams = (fn.abi?.parameters ?? []).filter(
    (param) => !isSystemContextParam(param)
  );
  const inputs = rawParams.map<ParsedField>((param) => ({
    path: param.name,
    label: param.name,
    type: normalizeType(param.type),
    visibility: param.visibility,
  }));

  return {
    name: fn.name,
    inputs: flattenFields(inputs),
    attributes: fn.custom_attributes ?? [],
    isUnconstrained: Boolean(fn.is_unconstrained),
  };
};

export const parseArtifactSource = (source: string): ParsedArtifact => {
  const parsed = JSON.parse(source) as NoirCompiledContract & {
    address?: string;
  };

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid artifact: expected JSON object');
  }

  if (!Array.isArray((parsed as { functions?: RawFunction[] }).functions)) {
    throw new Error('Invalid artifact: missing functions');
  }

  const compiled = parsed;
  const artifact = loadContractArtifact(compiled);
  const functions = (compiled as { functions: RawFunction[] }).functions.map(
    parseFunction
  );

  return {
    compiled,
    artifact,
    functions,
    discoveredAddress: parsed.address,
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
        return { ok: true, value: AztecAddress.fromString(value).toString() };
      } catch {
        return { ok: false, error: `Invalid Aztec address for ${path}` };
      }
    }
    case 'eth_address': {
      if (!value) {
        return { ok: false, error: `Missing ETH address for ${path}` };
      }
      try {
        return { ok: true, value: EthAddress.fromString(value).toString() };
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
      error: string;
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
      err instanceof Error ? err.message : 'Failed to parse artifact';
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
