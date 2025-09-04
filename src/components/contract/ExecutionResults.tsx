import React, { useState } from 'react';

export interface ExecutionResult {
  id: string;
  functionName: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
  result?: unknown;
  error?: string;
  transactionHash?: string;
  timestamp: Date;
  executionTime?: number;
}

export interface ExecutionResultsProps {
  /** Array of execution results */
  results: ExecutionResult[];
  /** Handler for clearing results */
  onClearResults?: () => void;
  /** Maximum number of results to display */
  maxResults?: number;
}

/**
 * Component for displaying contract function execution results
 * Shows transaction results, errors, and execution history
 */
export const ExecutionResults: React.FC<ExecutionResultsProps> = ({
  results,
  onClearResults,
  maxResults = 50,
}) => {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (resultId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedResults(newExpanded);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString();
  };

  const getStatusIcon = (status: ExecutionResult['status']): string => {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: ExecutionResult['status']): string => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const displayedResults = results.slice(0, maxResults);

  if (results.length === 0) {
    return (
      <div className="execution-results empty">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Executions Yet</h3>
          <p>Execute contract functions to see results here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="execution-results">
      <div className="results-header">
        <div className="header-info">
          <h3>
            <span className="header-icon">📊</span>
            Execution Results
          </h3>
          <span className="results-count">
            {results.length} execution{results.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {onClearResults && results.length > 0 && (
          <button
            type="button"
            onClick={onClearResults}
            className="btn btn-secondary btn-sm"
          >
            <span className="btn-icon">🗑️</span>
            Clear All
          </button>
        )}
      </div>

      <div className="results-list">
        {displayedResults.map((result) => {
          const isExpanded = expandedResults.has(result.id);
          
          return (
            <div
              key={result.id}
              className={`result-item ${result.status}`}
            >
              <div 
                className="result-header"
                onClick={() => toggleExpanded(result.id)}
              >
                <div className="result-info">
                  <div className="result-function">
                    <span 
                      className="status-icon"
                      style={{ color: getStatusColor(result.status) }}
                    >
                      {getStatusIcon(result.status)}
                    </span>
                    <span className="function-name">{result.functionName}</span>
                  </div>
                  
                  <div className="result-meta">
                    <span className="timestamp">{formatTimestamp(result.timestamp)}</span>
                    {result.executionTime && (
                      <span className="execution-time">
                        {result.executionTime}ms
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="result-actions">
                  {result.transactionHash && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(result.transactionHash!);
                      }}
                      className="copy-tx-btn"
                      title="Copy transaction hash"
                    >
                      🔗
                    </button>
                  )}
                  
                  <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                    ▼
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="result-body">
                  {/* Parameters */}
                  {Object.keys(result.parameters).length > 0 && (
                    <div className="result-section">
                      <h4>Parameters</h4>
                      <div className="parameters-display">
                        {Object.entries(result.parameters).map(([key, value]) => (
                          <div key={key} className="parameter-item">
                            <span className="parameter-name">{key}:</span>
                            <code className="parameter-value">
                              {formatValue(value)}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Result */}
                  {result.status === 'success' && result.result !== undefined && (
                    <div className="result-section">
                      <h4>Result</h4>
                      <div className="result-display success">
                        <code>{formatValue(result.result)}</code>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {result.status === 'error' && result.error && (
                    <div className="result-section">
                      <h4>Error</h4>
                      <div className="result-display error">
                        <code>{result.error}</code>
                      </div>
                    </div>
                  )}

                  {/* Transaction Hash */}
                  {result.transactionHash && (
                    <div className="result-section">
                      <h4>Transaction</h4>
                      <div className="transaction-info">
                        <code className="tx-hash">{result.transactionHash}</code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(result.transactionHash!)}
                          className="copy-btn"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pending Status */}
                  {result.status === 'pending' && (
                    <div className="result-section">
                      <div className="pending-display">
                        <span className="pending-icon">⏳</span>
                        <span>Executing function...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {results.length > maxResults && (
        <div className="results-footer">
          <p>Showing {maxResults} of {results.length} results</p>
        </div>
      )}
    </div>
  );
};
