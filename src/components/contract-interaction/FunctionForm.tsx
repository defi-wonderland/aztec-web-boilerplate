import React from 'react';
import {
  getPlaceholderForType,
  getLabelForType,
  shouldTrimInput,
} from './helpers';
import { Input } from '../ui';
import type { FunctionFormProps } from './types';
import type { ParsedType } from '../../utils/contractInteraction';

/**
 * FunctionForm styles - semantic pattern.
 */
const styles = {
  section: 'mt-4 p-4 rounded-lg border border-default bg-surface-secondary',
  grid: 'grid gap-4 sm:grid-cols-2',
  formGroup: 'space-y-1.5',
  label: 'block text-sm font-semibold text-default',
  labelRow: 'flex items-center gap-2',
  labelMain: 'text-default',
  typeHint: 'text-xs text-muted font-normal',
  subLabel: 'block text-xs text-muted',
} as const;

const FunctionForm = ({
  fn,
  values,
  onChange,
  disabled,
}: FunctionFormProps) => {
  const handleChange = (path: string, value: string, type: ParsedType) => {
    onChange(path, shouldTrimInput(type) ? value.trim() : value);
  };

  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        {fn.inputs
          .filter((input) => input.type.kind !== 'struct')
          .map((input) => {
            const typeLabel = getLabelForType(input.type);
            return (
              <div className={styles.formGroup} key={input.path}>
                <label
                  htmlFor={input.path}
                  className={styles.label}
                  title={
                    input.path.includes('.')
                      ? `${input.label} (${input.path})`
                      : input.label
                  }
                >
                  <span className={styles.labelRow}>
                    <span className={styles.labelMain}>{input.label}</span>
                    {typeLabel && (
                      <span className={styles.typeHint}>{typeLabel}</span>
                    )}
                  </span>
                  {input.path.includes('.') && (
                    <span className={styles.subLabel}>({input.path})</span>
                  )}
                </label>
                <Input
                  id={input.path}
                  value={values[input.path] ?? ''}
                  onChange={(e) =>
                    handleChange(input.path, e.target.value, input.type)
                  }
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
