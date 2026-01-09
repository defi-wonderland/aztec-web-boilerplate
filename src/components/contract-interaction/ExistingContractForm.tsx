import React from 'react';
import type { ExistingContractFormProps } from './types';

const ExistingContractForm = ({
  address,
  artifactInput,
  onAddressChange,
  onArtifactChange,
  onLoad,
  error,
  isValidAddress,
  isPreconfiguredMode,
  isLoadingPreconfigured = false,
  canLoad,
}: ExistingContractFormProps) => {
  return (
    <>
      <div className="form-group">
        <label htmlFor="contract-address">Contract Address</label>
        <input
          id="contract-address"
          className="form-input"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Paste deployed contract address"
          aria-label="Contract address"
        />
        {!isValidAddress && address && (
          <span className="input-hint error">Invalid Aztec address</span>
        )}
        {isPreconfiguredMode && (
          <span className="input-hint">
            Pre-filled address, but you can change it to use a different
            deployment.
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="artifact-json">Artifact (JSON)</label>
        <div className="artifact-textarea-wrapper">
          <textarea
            id="artifact-json"
            className={`form-input artifact-textarea${isPreconfiguredMode ? ' input-disabled' : ''}${isLoadingPreconfigured ? ' loading' : ''}`}
            value={isLoadingPreconfigured ? '' : artifactInput}
            onChange={(e) => onArtifactChange(e.target.value)}
            placeholder={
              isLoadingPreconfigured
                ? 'Loading artifact...'
                : 'Paste compiled artifact JSON'
            }
            aria-label="Artifact JSON"
            disabled={isPreconfiguredMode || isLoadingPreconfigured}
            readOnly={isPreconfiguredMode}
          />
          {isLoadingPreconfigured && (
            <div className="artifact-loading-overlay">
              <div className="loading-spinner" />
              <span>Loading artifact...</span>
            </div>
          )}
        </div>
      </div>

      {error && <div className="input-hint error">{error}</div>}

      <div className="action-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onLoad}
          disabled={!canLoad}
          aria-label={
            isPreconfiguredMode
              ? 'Load preconfigured contract'
              : 'Load custom artifact'
          }
        >
          {isPreconfiguredMode ? 'Load contract' : 'Load artifact'}
        </button>
      </div>
    </>
  );
};

export default ExistingContractForm;
