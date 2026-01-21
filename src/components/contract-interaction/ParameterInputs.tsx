import React from 'react';
import { Input } from '../ui';
import {
  getPlaceholderForType,
  getLabelForType,
  shouldTrimInput,
} from './helpers';
import type { ParsedType } from '../../utils/contractInteraction';

const styles = {
  grid: 'grid gap-4 sm:grid-cols-2',
} as const;

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
    <div className={styles.grid}>
      {filteredInputs.map((input) => {
        const typeLabel = getLabelForType(input.type);
        const inputId = idPrefix ? `${idPrefix}-${input.path}` : input.path;
        const hasNestedPath = showNestedPath && input.path.includes('.');

        return (
          <Input
            key={input.path}
            id={inputId}
            label={input.label}
            value={values[input.path] ?? ''}
            onChange={(e) =>
              handleChange(input.path, e.target.value, input.type)
            }
            placeholder={getPlaceholderForType(input.type)}
            disabled={disabled}
            helperText={
              hasNestedPath
                ? `Path: ${input.path}${typeLabel ? ` · ${typeLabel}` : ''}`
                : typeLabel || undefined
            }
          />
        );
      })}
    </div>
  );
};

export default ParameterInputs;
