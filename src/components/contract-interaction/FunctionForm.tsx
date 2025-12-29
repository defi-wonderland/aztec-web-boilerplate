import React from 'react';
import type { ParsedType } from '../../utils/contractInteraction';
import type { FunctionFormProps } from './types';

const placeholderForType = (type: ParsedType): string => {
  switch (type.kind) {
    case 'address':
      return '0x... (Aztec address)';
    case 'eth_address':
      return '0x... (ETH address)';
    case 'selector':
      return '0x12345678 (4-byte selector)';
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

const labelForType = (type: ParsedType): string | null => {
  switch (type.kind) {
    case 'address':
      return 'Aztec Address';
    case 'eth_address':
      return 'ETH Address';
    case 'selector':
      return 'Function Selector';
    case 'compressed_string':
      return 'Compressed String';
    default:
      return null;
  }
};

const FunctionForm = ({ fn, values, onChange, disabled }: FunctionFormProps) => {
  return (
    <div className="form-section">
      <div className="form-grid">
        {fn.inputs
          .filter((input) => input.type.kind !== 'struct')
          .map((input) => {
            const typeLabel = labelForType(input.type);
            return (
              <div className="form-group" key={input.path}>
                <label
                  htmlFor={input.path}
                  title={
                    input.path.includes('.')
                      ? `${input.label} (${input.path})`
                      : input.label
                  }
                >
                  <span className="form-label-row">
                    <span className="form-label-main">{input.label}</span>
                    {typeLabel && (
                      <span className="form-type-hint">{typeLabel}</span>
                    )}
                  </span>
                  {input.path.includes('.') && (
                    <span className="form-sub-label">({input.path})</span>
                  )}
                </label>
                <input
                  id={input.path}
                  className="form-input"
                  value={values[input.path] ?? ''}
                  onChange={(e) => onChange(input.path, e.target.value)}
                  placeholder={placeholderForType(input.type)}
                  disabled={disabled}
                  aria-label={input.path}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default FunctionForm;

