import React from 'react';
import type { PreconfiguredSelectorProps } from './types';

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

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    onSelect(value);
  };

  return (
    <div className="form-group">
      <label htmlFor="preconfigured-contract">Contract Source</label>
      <select
        id="preconfigured-contract"
        className="form-input"
        value={selectedId ?? ''}
        onChange={handleSelectChange}
        disabled={disabled || isLoading}
        aria-label="Select contract source"
      >
        <option value="">Custom (enter manually)</option>
        {preconfigured.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      {isCustomMode && (
        <div className="input-hint">
          Enter your own contract address and artifact below.
        </div>
      )}
      {isPreconfiguredMode && !isLoading && (
        <div className="input-hint success">
          Artifact is pre-filled. Address can be changed if needed.
        </div>
      )}
      {isLoading && (
        <div className="input-hint loading">Loading contract data...</div>
      )}
    </div>
  );
};

export default PreconfiguredSelector;

