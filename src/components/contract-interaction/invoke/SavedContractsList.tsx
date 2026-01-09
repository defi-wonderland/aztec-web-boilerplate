import React from 'react';
import type { SavedContractsListProps } from '../types';

const SavedContractsList = ({
  contracts,
  activeAddress,
  onApply,
  onDelete,
  onClearAll,
  canClear,
}: SavedContractsListProps) => {
  const normalizedActiveAddress = activeAddress.trim().toLowerCase();

  if (contracts.length === 0) {
    return null;
  }

  return (
    <div className="form-group">
      <div className="saved-contracts-header">
        <label>Saved contracts</label>
        <button
          type="button"
          className="btn btn-small btn-danger-outline"
          onClick={onClearAll}
          disabled={!canClear}
          aria-label="Clear all saved contracts"
          title="Remove all saved contracts from cache"
        >
          Clear all saved
        </button>
      </div>
      <div className="saved-contracts">
        {contracts.map((contract) => {
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
                    <span
                      className="saved-contract-badge"
                      aria-label="Active contract"
                    >
                      Active
                    </span>
                  )}
                </div>
                <div className="saved-contract-address">{contract.address}</div>
                <div className="saved-contract-meta">
                  {contract.artifact || contract.artifactKey
                    ? 'Artifact cached'
                    : 'Address only'}
                </div>
              </div>
              <div className="saved-contract-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onApply(contract)}
                  disabled={isActive}
                  aria-pressed={isActive}
                >
                  {useLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onDelete(contract.address)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SavedContractsList;
