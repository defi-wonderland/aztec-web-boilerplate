/**
 * Prefix used to preserve bigint identity in React Query keys.
 * Without this, `1n` and `'1'` could collide after serialization.
 */
const BIGINT_KEY_PREFIX = '__bigint__:';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
};

/**
 * Recursively normalizes values so they are safe for React Query key hashing.
 * Bigints are stringified with a type prefix, and nested structures are handled.
 */
export const normalizeQueryKeyValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    return `${BIGINT_KEY_PREFIX}${value.toString()}`;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeQueryKeyValue);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === 'object') {
    const objectWithToJSON = value as {
      toJSON?: () => unknown;
    };

    if (typeof objectWithToJSON.toJSON === 'function') {
      return normalizeQueryKeyValue(objectWithToJSON.toJSON());
    }

    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [
          key,
          normalizeQueryKeyValue(entryValue),
        ])
      );
    }
  }

  return value;
};

/**
 * Normalizes a scope key into a readonly array suitable for use as a query key prefix.
 *
 * - `undefined` → `[]`
 * - `string` → `[scopeKey]`
 * - `readonly unknown[]` → passthrough
 */
export const normalizeScopeKey = (
  scopeKey: string | readonly unknown[] | undefined
): readonly unknown[] => {
  if (scopeKey === undefined) return [];
  if (typeof scopeKey === 'string') return [scopeKey];
  return scopeKey;
};
