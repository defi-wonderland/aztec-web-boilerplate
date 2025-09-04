import React, { useState, useCallback, useMemo } from 'react';
import { AztecContractFunction } from '../../types';
import { ParameterInput } from './ParameterInput';

export interface FunctionCardProps {
  /** Function metadata */
  functionDef: AztecContractFunction;
  /** Function execution handler */
  onExecute: (functionName: string, parameters: Record<string, unknown>) => Promise<void>;
  /** Whether execution is in progress */
  isExecuting?: boolean;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Custom styling class */
  className?: string;
}

/**
 * Card component for displaying and executing a single contract function
 * Provides form inputs for parameters and execution controls
 */
export const FunctionCard: React.FC<FunctionCardProps> = ({
  functionDef,
  onExecute,
  isExecuting = false,
  disabled = false,
  className = '',
}) => {
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate function display properties
  const functionDisplay = useMemo(() => {
    const getIcon = () => {
      if (functionDef.isInitializer) return '🚀';
      switch (functionDef.visibility) {
        case 'private': return '🔒';
        case 'public': return '🌐';
        case 'unconstrained': return '⚡';
        default: return '📝';
      }
    };

    const getColor = () => {
      if (functionDef.isInitializer) return '#f59e0b';
      switch (functionDef.visibility) {
        case 'private': return '#8b5cf6';
        case 'public': return '#3b82f6';
        case 'unconstrained': return '#10b981';
        default: return '#6b7280';
      }
    };

    const getCategory = () => {
      if (functionDef.isInitializer) return 'initializer';
      return functionDef.visibility;
    };

    return {
      icon: getIcon(),
      color: getColor(),
      category: getCategory(),
      title: functionDef.name.charAt(0).toUpperCase() + functionDef.name.slice(1).replace(/_/g, ' '),
    };
  }, [functionDef]);

  // Handle parameter value changes
  const handleParameterChange = useCallback((paramName: string, value: unknown) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: value,
    }));

    // Clear error when value changes
    if (errors[paramName]) {
      setErrors(prev => {
        const { [paramName]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [errors]);

  // Validate parameters before execution
  const validateParameters = useCallback(() => {
    const newErrors: Record<string, string> = {};

    functionDef.parameters.forEach(param => {
      const value = parameters[param.name];
      
      // Check required parameters
      if (value === undefined || value === null || value === '') {
        newErrors[param.name] = 'This parameter is required';
        return;
      }

      // Type-specific validation
      switch (param.type) {
        case 'u8':
        case 'u16':
        case 'u32':
        case 'u64':
        case 'u128':
          if (typeof value === 'string' && isNaN(Number(value))) {
            newErrors[param.name] = 'Must be a valid number';
          } else if (Number(value) < 0) {
            newErrors[param.name] = 'Must be a positive number';
          }
          break;

        case 'i8':
        case 'i16':
        case 'i32':
        case 'i64':
        case 'i128':
          if (typeof value === 'string' && isNaN(Number(value))) {
            newErrors[param.name] = 'Must be a valid number';
          }
          break;

        case 'Field':
          if (typeof value === 'string' && (isNaN(Number(value)) || Number(value) < 0)) {
            newErrors[param.name] = 'Must be a valid positive number';
          }
          break;

        case 'AztecAddress':
          const addressPattern = /^0x[a-fA-F0-9]{64}$/;
          if (typeof value === 'string' && !addressPattern.test(value)) {
            newErrors[param.name] = 'Invalid Aztec address format';
          }
          break;

        case 'bool':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            newErrors[param.name] = 'Must be true or false';
          }
          break;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [functionDef.parameters, parameters]);

  // Handle function execution
  const handleExecute = useCallback(async () => {
    if (!validateParameters()) {
      return;
    }

    try {
      await onExecute(functionDef.name, parameters);
      // Clear form after successful execution
      setParameters({});
    } catch (error) {
      // Error handling is done by parent component
    }
  }, [functionDef.name, parameters, onExecute, validateParameters]);

  // Toggle expanded view
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const hasParameters = functionDef.parameters.length > 0;
  const isReadyToExecute = !hasParameters || Object.keys(parameters).length > 0;

  return (
    <div className={`function-card ${functionDisplay.category} ${className}`}>
      <div className="function-header" onClick={hasParameters ? toggleExpanded : undefined}>
        <div className="function-info">
          <div className="function-icon-wrapper">
            <span 
              className="function-icon"
              style={{ color: functionDisplay.color }}
            >
              {functionDisplay.icon}
            </span>
          </div>
          
          <div className="function-details">
            <h4 className="function-title">{functionDisplay.title}</h4>
            <div className="function-meta">
              <span className="function-visibility">{functionDisplay.category}</span>
              <span className="function-params">
                {functionDef.parameters.length} parameter{functionDef.parameters.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="function-actions">
          {!hasParameters && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={disabled || isExecuting}
              className="btn btn-sm btn-primary"
            >
              <span className="btn-icon">{functionDisplay.icon}</span>
              {isExecuting ? 'Executing...' : 'Execute'}
            </button>
          )}
          
          {hasParameters && (
            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
              ▼
            </span>
          )}
        </div>
      </div>

      {hasParameters && isExpanded && (
        <div className="function-body">
          <div className="parameters-section">
            <h5 className="section-title">Parameters</h5>
            
            <div className="parameters-grid">
              {functionDef.parameters.map((param) => (
                <ParameterInput
                  key={param.name}
                  parameter={param}
                  value={parameters[param.name]}
                  onChange={(value) => handleParameterChange(param.name, value)}
                  disabled={disabled || isExecuting}
                  error={errors[param.name]}
                />
              ))}
            </div>
          </div>

          <div className="function-footer">
            <button
              type="button"
              onClick={handleExecute}
              disabled={disabled || isExecuting || !isReadyToExecute}
              className="btn btn-primary"
            >
              <span className="btn-icon">{functionDisplay.icon}</span>
              {isExecuting ? 'Executing...' : `Execute ${functionDisplay.title}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
