import React from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui';
import type { PreconfiguredSelectorProps } from './types';

/**
 * PreconfiguredSelector styles - semantic pattern.
 */
const styles = {
  formGroup: 'space-y-1.5',
  label: 'block text-sm font-semibold text-default',
  hint: 'text-xs text-muted mt-1',
  hintSuccess: 'text-xs text-green-500 mt-1',
  hintLoading: 'text-xs text-blue-500 mt-1',
} as const;

/**
 * Dropdown selector for preconfigured contracts.
 * Allows user to select a pre-configured contract or enter custom values.
 */
const PreconfiguredSelector = ({
  preconfigured,
  selectedId,
  onSelect,
  isLoading = false,
  disabled = false,
}: PreconfiguredSelectorProps) => {
  const isCustomMode = !selectedId;
  const isPreconfiguredMode = Boolean(selectedId);

  const handleSelectChange = (value: string) => {
    onSelect(value === 'custom' ? null : value);
  };

  return (
    <div className={styles.formGroup}>
      <label htmlFor="preconfigured-contract" className={styles.label}>
        Contract Source
      </label>
      <Select
        value={selectedId ?? 'custom'}
        onValueChange={handleSelectChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id="preconfigured-contract">
          <SelectValue placeholder="Select contract source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom">Custom (enter manually)</SelectItem>
          {preconfigured.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isCustomMode && (
        <div className={styles.hint}>
          Enter your own contract address and artifact below.
        </div>
      )}
      {isPreconfiguredMode && !isLoading && (
        <div className={styles.hintSuccess}>
          Artifact is pre-filled. Address can be changed if needed.
        </div>
      )}
      {isLoading && (
        <div className={styles.hintLoading}>Loading contract data...</div>
      )}
    </div>
  );
};

export default PreconfiguredSelector;
