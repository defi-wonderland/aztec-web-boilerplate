/**
 * Recursively converts bigint values to strings for JSON serialization.
 * Used when sending args to browser wallet connectors over message channels.
 */
export const serializeArgs = (args: unknown[]): unknown[] => {
  return args.map(serializeValue);
};

const serializeValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value !== null && typeof value === 'object') {
    // Preserve objects with toJSON (e.g., AztecAddress)
    const obj = value as { toJSON?: () => unknown };
    if (typeof obj.toJSON === 'function') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeValue(v)])
    );
  }

  return value;
};
