import React from 'react';
import type { FunctionListProps } from './types';

const FunctionList = ({
  groups,
  selected,
  onSelect,
  filter,
  onFilterChange,
  contractName,
  hasContract,
}: FunctionListProps) => {
  const title = contractName ? `Search functions · ${contractName}` : 'Search functions';
  const EmptyIcon = () => (
    <span role="img" aria-label="warning" className="empty-icon empty-icon-sm">
      ⚠️
    </span>
  );
  return (
    <div className="function-list-card">
      <div className="form-group">
        <label htmlFor="function-filter">{title}</label>
        <input
          id="function-filter"
          className="form-input"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Type to filter"
        />
      </div>
      {groups.map((group) => {
        const description =
          group.id === 'callable'
            ? 'State-changing calls that submit transactions.'
            : 'Read-only or unconstrained helpers; simulate to preview.';
        return (
          <div className="function-group" key={group.id}>
            <div className="function-group-header">
              <div className="function-group-label">{group.label}</div>
              <div className="function-group-description">{description}</div>
            </div>
            <div className="function-list">
              {group.items.map((fn) => (
                <button
                  key={fn.name}
                  type="button"
                  className={`function-item ${selected === fn.name ? 'active' : ''}`}
                  onClick={() => onSelect(fn.name)}
                >
                  <span className="function-name">{fn.name}</span>
                  <span className="function-meta">
                    {fn.attributes.join(' · ') || 'public'}
                  </span>
                </button>
              ))}
              {group.items.length === 0 && (
                <div className="empty-state">No functions in this group.</div>
              )}
            </div>
          </div>
        );
      })}
      {groups.length === 0 && (
        <div className="empty-state">
          <EmptyIcon />
          <br />
          {hasContract
            ? 'No functions found for current filter.'
            : 'Load or select a contract to view its functions.'}
        </div>
      )}
    </div>
  );
};

export default FunctionList;

