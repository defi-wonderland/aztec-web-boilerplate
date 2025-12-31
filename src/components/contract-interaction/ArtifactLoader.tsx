import React from 'react';
import type { ArtifactLoaderProps } from './types';

const ArtifactLoader = ({
  address,
  artifactInput,
  onAddressChange,
  onArtifactChange,
  onLoad,
  onClear,
  hasCache,
  savedContracts,
  onApplySaved,
  onDeleteSaved,
  error,
  isValidAddress,
  activeAddress,
  preconfigured,
  selectedPreconfiguredId,
  onApplyPreconfigured,
  isLoadingPreconfigured = false,
}: ArtifactLoaderProps) => {
  const normalizedActiveAddress = activeAddress.trim().toLowerCase();
  const isCustomMode = !selectedPreconfiguredId;
  const isPreconfiguredMode = Boolean(selectedPreconfiguredId);
  
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value || null;
    onApplyPreconfigured?.(selectedId);
  };

  const canLoad = isCustomMode 
    ? Boolean(address && artifactInput)
    : isPreconfiguredMode && !isLoadingPreconfigured;
  
  const canClear = (hasCache || address || artifactInput || isPreconfiguredMode) && !isLoadingPreconfigured;

  return (
    <div className="loader-card">
      {preconfigured?.length ? (
        <div className="form-group">
          <label htmlFor="preconfigured-contract">Contract Source</label>
          <select
            id="preconfigured-contract"
            className="form-input"
            value={selectedPreconfiguredId ?? ''}
            onChange={handleSelectChange}
            aria-label="Select contract source"
          >
            <option value="">
              Custom (enter manually)
            </option>
            {preconfigured.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {isCustomMode && (
            <div className="input-hint">Enter your own contract address and artifact below.</div>
          )}
          {isPreconfiguredMode && !isLoadingPreconfigured && (
            <div className="input-hint success">Artifact is pre-filled. Address can be changed if needed.</div>
          )}
          {isLoadingPreconfigured && (
            <div className="input-hint loading">Loading contract data...</div>
          )}
        </div>
      ) : null}
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
          <span className="input-hint">Pre-filled address, but you can change it to use a different deployment.</span>
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
            placeholder={isLoadingPreconfigured ? 'Loading artifact...' : 'Paste compiled artifact JSON'}
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
          aria-label={isPreconfiguredMode ? 'Load preconfigured contract' : 'Load custom artifact'}
        >
          {isPreconfiguredMode ? 'Load contract' : 'Load artifact'}
        </button>
      </div>
      {savedContracts.length > 0 && (
        <div className="form-group">
          <div className="saved-contracts-header">
            <label>Saved contracts</label>
            <button
              type="button"
              className="btn btn-small btn-danger-outline"
              onClick={onClear}
              disabled={!canClear}
              aria-label="Clear all saved contracts"
              title="Remove all saved contracts from cache"
            >
              Clear all saved
            </button>
          </div>
          <div className="saved-contracts">
            {savedContracts.map((contract) => {
              const isActive =
                normalizedActiveAddress === contract.address.trim().toLowerCase();
              const useLabel = isActive ? 'Active' : 'Use';
              return (
                <div
                  className={`saved-contract-card${isActive ? ' active' : ''}`}
                  key={contract.address}
                >
                  <div className="saved-contract-info">
                    <div className="saved-contract-title">
                      <div className="saved-contract-name">
                        {contract.label ?? 'Saved contract'}
                      </div>
                      {isActive && (
                        <span className="saved-contract-badge" aria-label="Active contract">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="saved-contract-address">{contract.address}</div>
                    <div className="saved-contract-meta">
                      {contract.artifact || contract.artifactKey ? 'Artifact cached' : 'Address only'}
                    </div>
                  </div>
                  <div className="saved-contract-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onApplySaved(contract)}
                      disabled={isActive}
                      aria-pressed={isActive}
                    >
                      {useLabel}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onDeleteSaved(contract.address)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactLoader;

