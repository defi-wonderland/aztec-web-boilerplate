import type { ParsedType } from '../../utils/contractInteraction';

export const getPlaceholderForType = (type: ParsedType): string => {
  switch (type.kind) {
    case 'address':
      return '0x... (Aztec address)';
    case 'eth_address':
      return '0x... (ETH address)';
    case 'selector':
      return '0x12345678 (4-byte selector)';
    case 'string':
    case 'compressed_string':
      return 'Text (max 31 chars)';
    case 'integer':
    case 'field':
      return 'Numeric value';
    case 'boolean':
      return 'true / false';
    case 'array':
      return 'Comma-separated values';
    case 'struct':
      return 'Object field';
    default:
      return 'Value';
  }
};

export const getLabelForType = (type: ParsedType): string | null => {
  switch (type.kind) {
    case 'address':
      return 'Aztec Address';
    case 'eth_address':
      return 'ETH Address';
    case 'selector':
      return 'Function Selector';
    case 'string':
    case 'compressed_string':
      return 'String';
    case 'integer':
    case 'field':
      return 'Integer';
    case 'boolean':
      return 'Boolean';
    default:
      return null;
  }
};

export const shouldTrimInput = (type: ParsedType): boolean => {
  switch (type.kind) {
    case 'address':
    case 'eth_address':
    case 'selector':
    case 'integer':
    case 'field':
    case 'boolean':
      return true;
    default:
      return false;
  }
};
