/**
 * Mapping of Aztec struct type paths to their simplified kind identifiers.
 * Used to identify well-known struct types that should be treated as primitives
 * rather than flattened into their component fields.
 */
export const KNOWN_STRUCT_PATHS: Record<string, string> = {
  'aztec::protocol_types::address::aztec_address::AztecAddress': 'address',
  'aztec::protocol_types::address::eth_address::EthAddress': 'eth_address',
  'aztec::protocol_types::abis::function_selector::FunctionSelector':
    'selector',
  'compressed_string::field_compressed_string::FieldCompressedString':
    'compressed_string',
} as const;

/**
 * Checks if a struct path is a known Aztec type that should be treated as a primitive.
 */
export const isKnownStructPath = (path: string | undefined): boolean =>
  path !== undefined && path in KNOWN_STRUCT_PATHS;

/**
 * Gets the simplified kind for a known struct path, or undefined if not known.
 */
export const getKnownStructKind = (path: string): string | undefined =>
  KNOWN_STRUCT_PATHS[path];
