import React from 'react';
import {
  getPlaceholderForType,
  getLabelForType,
  shouldTrimInput,
} from './helpers';
import type { ParsedType } from '../../utils/contractInteraction';

export interface ParameterInput {
  path: string;
  label: string;
  type: ParsedType;
}

export interface ParameterInputsProps {
  inputs: ParameterInput[];
  values: Record<string, string>;
  onChange: (path: string, value: string) => void;
  disabled?: boolean;
  idPrefix?: string;
  showNestedPath?: boolean;
  trimOnChange?: boolean;
}

const ParameterInputs: React.FC<ParameterInputsProps> = ({
  inputs,
  values,
  onChange,
  disabled = false,
  idPrefix = '',
  showNestedPath = false,
  trimOnChange = false,
}) => {
  const handleChange = (path: string, value: string, type: ParsedType) => {
    const shouldTrim = trimOnChange && shouldTrimInput(type);
    onChange(path, shouldTrim ? value.trim() : value);
  };

  const filteredInputs = inputs.filter((input) => input.type.kind !== 'struct');

  if (filteredInputs.length === 0) {
    return null;
  }

  return (
    <div className="form-grid">
      {filteredInputs.map((input) => {
        const typeLabel = getLabelForType(input.type);
        const inputId = idPrefix ? `${idPrefix}-${input.path}` : input.path;
        const hasNestedPath = showNestedPath && input.path.includes('.');

        return (
          <div className="form-group" key={input.path}>
            <label
              htmlFor={inputId}
              title={
                hasNestedPath ? `${input.label} (${input.path})` : input.label
              }
            >
              <span className="form-label-row">
                <span className="form-label-main">{input.label}</span>
                {typeLabel && (
                  <span className="form-type-hint">{typeLabel}</span>
                )}
              </span>
              {hasNestedPath && (
                <span className="form-sub-label">({input.path})</span>
              )}
            </label>
            <input
              id={inputId}
              className="form-input"
              value={values[input.path] ?? ''}
              onChange={(e) =>
                handleChange(input.path, e.target.value, input.type)
              }
              placeholder={getPlaceholderForType(input.type)}
              disabled={disabled}
              aria-label={hasNestedPath ? input.path : input.label}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ParameterInputs;
