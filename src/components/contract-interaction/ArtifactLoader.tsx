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
}: ArtifactLoaderProps) => {
  const normalizedActiveAddress = activeAddress.trim().toLowerCase();
  return (
    <div className="loader-card">
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
      </div>
      <div className="form-group">
        <label htmlFor="artifact-json">Artifact (JSON)</label>
        <textarea
          id="artifact-json"
          className="form-input artifact-textarea"
          value={artifactInput}
          onChange={(e) => onArtifactChange(e.target.value)}
          placeholder="Paste compiled artifact JSON"
          aria-label="Artifact JSON"
        />
      </div>
      {error && <div className="input-hint error">{error}</div>}
      <div className="action-row">
        <button type="button" className="btn btn-primary" onClick={onLoad}>
          Load artifact
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClear}
          disabled={!hasCache && !address && !artifactInput}
        >
          Clear saved
        </button>
      </div>
      {savedContracts.length > 0 && (
        <div className="form-group">
          <label>Saved contracts</label>
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

