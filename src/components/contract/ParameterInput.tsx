import React, { useState, useCallback, useMemo } from 'react';
import { AztecFunctionParameter, AztecParameterType } from '../../types';

export interface ParameterInputProps {
  /** Parameter metadata from the artifact */
  parameter: AztecFunctionParameter;
  /** Current value */
  value: unknown;
  /** Value change handler */
  onChange: (value: unknown) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Custom error message */
  error?: string;
  /** Custom placeholder text */
  placeholder?: string;
}

/**
 * Dynamic input component for Aztec contract function parameters
 * Handles different parameter types with appropriate validation and UI
 */
export const ParameterInput: React.FC<ParameterInputProps> = ({
  parameter,
  value,
  onChange,
  disabled = false,
  error,
  placeholder,
}) => {
  const [touched, setTouched] = useState(false);

  // Generate input ID for accessibility
  const inputId = useMemo(() => 
    `param-${parameter.name.replace(/[^a-zA-Z0-9]/g, '-')}`, 
    [parameter.name]
  );

  // Generate appropriate placeholder text
  const defaultPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    
    switch (parameter.type) {
      case 'Field':
        return 'Enter a field value (e.g., 123)';
      case 'bool':
        return 'true or false';
      case 'u8':
      case 'u16':
      case 'u32':
      case 'u64':
      case 'u128':
        return 'Enter positive integer';
      case 'i8':
      case 'i16':
      case 'i32':
      case 'i64':
      case 'i128':
        return 'Enter signed integer';
      case 'array':
        return 'Enter comma-separated values';
      case 'struct':
        return 'Enter JSON object';
      case 'AztecAddress':
        return 'Enter Aztec address (0x...)';
      case 'string':
        return 'Enter text value';
      default:
        return `Enter ${parameter.name}`;
    }
  }, [parameter, placeholder]);

  // Generate help text based on parameter type
  const helpText = useMemo(() => {
    switch (parameter.type) {
      case 'Field':
        return 'Aztec field element (large integer)';
      case 'u8':
        return 'Unsigned 8-bit integer (0-255)';
      case 'u16':
        return 'Unsigned 16-bit integer (0-65535)';
      case 'u32':
        return 'Unsigned 32-bit integer';
      case 'u64':
        return 'Unsigned 64-bit integer';
      case 'u128':
        return 'Unsigned 128-bit integer';
      case 'i8':
        return 'Signed 8-bit integer (-128 to 127)';
      case 'i16':
        return 'Signed 16-bit integer (-32768 to 32767)';
      case 'i32':
        return 'Signed 32-bit integer';
      case 'i64':
        return 'Signed 64-bit integer';
      case 'i128':
        return 'Signed 128-bit integer';
      case 'array':
        return 'Array of elements (comma-separated)';
      case 'struct':
        return 'Complex object - enter as JSON';
      case 'AztecAddress':
        return 'Aztec address format: 0x followed by 64 hexadecimal characters';
      case 'bool':
        return 'Boolean value (true/false)';
      case 'string':
        return 'Text string value';
      default:
        return `Parameter of type ${parameter.type}`;
    }
  }, [parameter.type]);

  // Validation patterns
  const getValidationPattern = useCallback(() => {
    switch (parameter.type) {
      case 'AztecAddress':
        return '^0x[a-fA-F0-9]{64}$';
      case 'u8':
      case 'u16':
      case 'u32':
      case 'u64':
      case 'u128':
      case 'Field':
        return '^[0-9]+$';
      case 'i8':
      case 'i16':
      case 'i32':
      case 'i64':
      case 'i128':
        return '^-?[0-9]+$';
      default:
        return undefined;
    }
  }, [parameter.type]);

  // Handle input blur for validation
  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  // Handle value changes with type conversion
  const handleChange = useCallback((newValue: string) => {
    switch (parameter.type) {
      case 'bool':
        onChange(newValue.toLowerCase() === 'true');
        break;
      case 'u8':
      case 'u16':
      case 'u32':
      case 'u64':
      case 'u128':
      case 'i8':
      case 'i16':
      case 'i32':
      case 'i64':
      case 'i128':
      case 'Field':
        // Keep as string to avoid precision loss with large integers
        onChange(newValue);
        break;
      case 'array':
        // Split by comma and trim whitespace
        const arrayValue = newValue.split(',').map(item => item.trim()).filter(Boolean);
        onChange(arrayValue);
        break;
      case 'AztecAddress':
        onChange(newValue);
        break;
      case 'struct':
        // Try to parse as JSON for complex objects
        try {
          const parsed = JSON.parse(newValue);
          onChange(parsed);
        } catch {
          // Keep as string if not valid JSON
          onChange(newValue);
        }
        break;
      default:
        onChange(newValue);
    }
  }, [parameter.type, onChange]);

  // Determine input type and component
  const renderInput = () => {
    const commonProps = {
      id: inputId,
      disabled,
      onBlur: handleBlur,
      className: `form-input ${error && touched ? 'error' : ''}`,
      placeholder: defaultPlaceholder,
      pattern: getValidationPattern(),
    };

    switch (parameter.type) {
      case 'bool':
        return (
          <select
            {...commonProps}
            value={value?.toString() || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="form-select"
          >
            <option value="">Select...</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        );

      case 'array':
      case 'struct':
        // Use textarea for complex types
        return (
          <textarea
            {...commonProps}
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => handleChange(e.target.value)}
            rows={4}
            className="form-textarea"
            placeholder="Enter JSON object"
          />
        );
        
      default:
        return (
          <input
            {...commonProps}
            type="text"
            value={value?.toString() || ''}
            onChange={(e) => handleChange(e.target.value)}
          />
        );
    }
  };

  return (
    <div className="form-group">
      <label htmlFor={inputId} className="form-label">
        {parameter.name.charAt(0).toUpperCase() + parameter.name.slice(1).replace(/_/g, ' ')}
        {parameter.type !== 'bool' && (
          <span className="parameter-type">({parameter.type})</span>
        )}
      </label>
      
      {renderInput()}
      
      {(error && touched) && (
        <div className="form-error">
          {error}
        </div>
      )}
      
      {helpText && (
        <div className="form-help">
          {helpText}
        </div>
      )}
    </div>
  );
};
