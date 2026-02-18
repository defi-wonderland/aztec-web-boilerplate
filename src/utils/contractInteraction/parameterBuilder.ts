import { AztecAddress, EthAddress } from '@aztec/aztec.js/addresses';
import type { ParsedType, ParsedField } from '../../types/artifact';

type BuildResult = { ok: true; value: unknown } | { ok: false; error: string };

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
): BuildResult => {
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

/**
 * Builds function arguments from form input values.
 * Converts string form values to properly typed arguments based on ParsedField definitions.
 */
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
