import React from 'react';
import type { ParsedType } from '../../utils/contractInteraction';
import type { FunctionFormProps } from './types';
import {
  getPlaceholderForType,
  getLabelForType,
  shouldTrimInput,
} from './helpers';

const FunctionForm = ({ fn, values, onChange, disabled }: FunctionFormProps) => {
  const handleChange = (path: string, value: string, type: ParsedType) => {
    onChange(path, shouldTrimInput(type) ? value.trim() : value);
  };

  return (
    <div className="form-section">
      <div className="form-grid">
        {fn.inputs
          .filter((input) => input.type.kind !== 'struct')
          .map((input) => {
            const typeLabel = getLabelForType(input.type);
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
                  onChange={(e) => handleChange(input.path, e.target.value, input.type)}
                  placeholder={getPlaceholderForType(input.type)}
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
