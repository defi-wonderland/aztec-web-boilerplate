import React, { useState, useCallback, useMemo } from 'react';
import { AztecContractMetadata, AztecContractFunction } from '../../types';
import { FunctionCard } from './FunctionCard';

export interface DynamicContractFormProps {
  /** Parsed contract metadata */
  contractMetadata: AztecContractMetadata;
  /** Function execution handler */
  onExecuteFunction: (functionName: string, parameters: Record<string, unknown>) => Promise<void>;
  /** Whether any function is currently executing */
  isExecuting?: boolean;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

export interface FunctionCategory {
  title: string;
  icon: string;
  functions: AztecContractFunction[];
  description: string;
  color: string;
}

/**
 * Dynamic form component that generates UI for interacting with Aztec contracts
 * Takes parsed contract metadata and creates categorized function interfaces
 */
export const DynamicContractForm: React.FC<DynamicContractFormProps> = ({
  contractMetadata,
  onExecuteFunction,
  isExecuting = false,
  disabled = false,
  className = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('initializers');
  const [searchTerm, setSearchTerm] = useState('');

  // Categorize functions by type
  const functionCategories = useMemo(() => {
    const categories: Record<string, FunctionCategory> = {};

    // Initialize categories
    if (contractMetadata.initializers.length > 0) {
      categories.initializers = {
        title: 'Initializers',
        icon: '🚀',
        functions: contractMetadata.initializers,
        description: 'Contract initialization functions',
        color: '#f59e0b',
      };
    }

    if (contractMetadata.privateFunctions.length > 0) {
      categories.private = {
        title: 'Private Functions',
        icon: '🔒',
        functions: contractMetadata.privateFunctions,
        description: 'Functions that execute privately with zero-knowledge proofs',
        color: '#8b5cf6',
      };
    }

    if (contractMetadata.publicFunctions.length > 0) {
      categories.public = {
        title: 'Public Functions',
        icon: '🌐',
        functions: contractMetadata.publicFunctions,
        description: 'Functions that execute publicly on the Aztec network',
        color: '#3b82f6',
      };
    }

    if (contractMetadata.unconstrainedFunctions.length > 0) {
      categories.unconstrained = {
        title: 'View Functions',
        icon: '⚡',
        functions: contractMetadata.unconstrainedFunctions,
        description: 'Read-only functions for querying contract state',
        color: '#10b981',
      };
    }

    return categories;
  }, [contractMetadata]);

  // Filter functions based on search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return functionCategories;

    const filtered: Record<string, FunctionCategory> = {};
    const lowerSearchTerm = searchTerm.toLowerCase();

    Object.entries(functionCategories).forEach(([key, category]) => {
      const matchingFunctions = category.functions.filter(func =>
        func.name.toLowerCase().includes(lowerSearchTerm) ||
        func.parameters.some(param => 
          param.name.toLowerCase().includes(lowerSearchTerm)
        )
      );

      if (matchingFunctions.length > 0) {
        filtered[key] = {
          ...category,
          functions: matchingFunctions,
        };
      }
    });

    return filtered;
  }, [functionCategories, searchTerm]);

  // Set initial active category
  useMemo(() => {
    const availableCategories = Object.keys(filteredCategories);
    if (availableCategories.length > 0 && !availableCategories.includes(activeCategory)) {
      setActiveCategory(availableCategories[0]);
    }
  }, [filteredCategories, activeCategory]);

  // Handle category selection
  const handleCategoryChange = useCallback((categoryKey: string) => {
    setActiveCategory(categoryKey);
  }, []);

  // Handle search input
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const activeCategoryData = filteredCategories[activeCategory];
  const categoryKeys = Object.keys(filteredCategories);

  if (categoryKeys.length === 0) {
    return (
      <div className={`contract-form no-functions ${className}`}>
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No Functions Found</h3>
          <p>
            {searchTerm 
              ? `No functions match "${searchTerm}"`
              : 'This contract has no executable functions.'
            }
          </p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="btn btn-secondary"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`contract-form ${className}`}>
      {/* Contract Header */}
      <div className="contract-header">
        <div className="contract-info">
          <div className="contract-icon">📄</div>
          <div>
            <h2 className="contract-title">{contractMetadata.name}</h2>
            <div className="contract-meta">
              <span className="contract-version">
                Noir {contractMetadata.noirVersion}
              </span>
              {contractMetadata.isTranspiled && (
                <span className="contract-transpiled">Transpiled</span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="contract-search">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search functions..."
            className="form-input search-input"
            disabled={disabled}
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {/* Function Categories */}
      <div className="function-categories">
        <div className="category-tabs">
          {categoryKeys.map((categoryKey) => {
            const category = filteredCategories[categoryKey];
            const isActive = categoryKey === activeCategory;
            
            return (
              <button
                key={categoryKey}
                type="button"
                onClick={() => handleCategoryChange(categoryKey)}
                disabled={disabled}
                className={`category-tab ${isActive ? 'active' : ''}`}
                style={{ 
                  borderColor: isActive ? category.color : undefined,
                  color: isActive ? category.color : undefined,
                }}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-title">{category.title}</span>
                <span className="category-count">({category.functions.length})</span>
              </button>
            );
          })}
        </div>

        {/* Active Category Content */}
        {activeCategoryData && (
          <div className="category-content">
            <div className="category-header">
              <div className="category-info">
                <span 
                  className="category-icon-large"
                  style={{ color: activeCategoryData.color }}
                >
                  {activeCategoryData.icon}
                </span>
                <div>
                  <h3 className="category-title">{activeCategoryData.title}</h3>
                  <p className="category-description">{activeCategoryData.description}</p>
                </div>
              </div>
            </div>

            <div className="functions-grid">
              {activeCategoryData.functions.map((func) => (
                <FunctionCard
                  key={func.name}
                  functionDef={func}
                  onExecute={onExecuteFunction}
                  isExecuting={isExecuting}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
