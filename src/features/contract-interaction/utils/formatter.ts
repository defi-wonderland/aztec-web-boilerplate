import type {
  ParsedType,
  ParsedFunction,
  ParsedArtifact,
  ArtifactSummary,
} from '../../../types/artifact';

/**
 * Formats a ParsedType into a human-readable string.
 */
export const formatParsedType = (type: ParsedType): string => {
  switch (type.kind) {
    case 'field':
      return 'Field';
    case 'integer':
      return `${type.sign === 'unsigned' ? 'U' : 'I'}${type.width}`;
    case 'boolean':
      return 'Boolean';
    case 'string':
      return 'String';
    case 'address':
      return 'AztecAddress';
    case 'eth_address':
      return 'EthAddress';
    case 'selector':
      return 'Selector';
    case 'compressed_string':
      return 'CompressedString';
    case 'array':
      return `Array<${formatParsedType(type.type)}>${type.length ? `[${type.length}]` : ''}`;
    case 'struct':
      return type.path?.split('::').pop() ?? 'Struct';
    default:
      return 'Unknown';
  }
};

/**
 * Creates a lightweight summary of a parsed artifact for display purposes.
 */
export const createArtifactSummary = (
  parsed: ParsedArtifact
): ArtifactSummary => ({
  name: (parsed.compiled as { name?: string })?.name ?? 'Contract',
  functionCount: parsed.functions.length,
});

/**
 * Formats a function signature for display (e.g., "transfer(to, amount)").
 */
export const formatFunctionSignature = (fn: ParsedFunction): string => {
  const params = fn.inputs
    .filter((input) => !input.path.includes('.'))
    .map((input) => input.label)
    .join(', ');
  return `${fn.name}(${params})`;
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
