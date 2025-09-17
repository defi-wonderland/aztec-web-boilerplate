import React, { useState } from 'react';

interface AbiInput {
  name: string;
  type: string;
  internalType?: string;
}

interface AbiFunction {
  name: string;
  type: 'function';
  inputs: AbiInput[];
  outputs?: AbiInput[];
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
}

interface ContractFunctionProps {
  func: AbiFunction;
  onExecute: (functionName: string, args: any[]) => Promise<any>;
  isExecuting?: boolean;
}

export const ContractFunction: React.FC<ContractFunctionProps> = ({
  func,
  onExecute,
  isExecuting = false
}) => {
  const [inputs, setInputs] = useState<{ [key: string]: string }>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const isReadFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';
  const isPayable = func.stateMutability === 'payable';

  const handleInputChange = (inputName: string, value: string) => {
    setInputs(prev => ({
      ...prev,
      [inputName]: value
    }));
  };

  const parseInputValue = (value: string, type: string): any => {
    if (!value.trim()) return '';
    
    try {
      // Handle Aztec-specific types
      if (type === 'field') {
        // Aztec field elements - can be numbers or hex strings
        if (value.startsWith('0x')) {
          return value;
        }
        return BigInt(value).toString();
      }
      
      if (type === 'bool') {
        return value.toLowerCase() === 'true';
      }
      
      if (type.startsWith('u') || type.startsWith('i')) {
        // Handle integer types like u32, i64, etc.
        return BigInt(value).toString();
      }
      
      if (type.startsWith('string<')) {
        return value;
      }
      
      if (type.includes('Address') || type === 'AztecAddress') {
        // Aztec addresses
        return value.startsWith('0x') ? value : `0x${value}`;
      }
      
      if (type.includes('[') && type.includes(']')) {
        // Handle arrays
        return JSON.parse(value);
      }
      
      if (type.startsWith('(') && type.endsWith(')')) {
        // Handle tuples
        return JSON.parse(value);
      }
      
      if (type === 'struct' || type.includes('struct')) {
        // Handle structs as JSON objects
        return JSON.parse(value);
      }
      
      // Legacy Ethereum types for compatibility
      switch (type) {
        case 'uint256':
        case 'uint':
        case 'int256':
        case 'int':
          return BigInt(value).toString();
        case 'address':
          return value;
        case 'bytes':
        case 'bytes32':
          return value.startsWith('0x') ? value : `0x${value}`;
        case 'string':
          return value;
        default:
          return value;
      }
    } catch (err) {
      throw new Error(`Invalid value for type ${type}: ${value}`);
    }
  };

  const handleExecute = async () => {
    setError(null);
    setResult(null);

    try {
      // Parse inputs according to their types
      const args = func.inputs.map(input => {
        const value = inputs[input.name] || '';
        return parseInputValue(value, input.type);
      });

      const result = await onExecute(func.name, args);
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    }
  };

  const getInputPlaceholder = (type: string): string => {
    // Handle Aztec-specific types
    if (type === 'field') {
      return 'Field element (e.g., 123 or 0x1a2b3c...)';
    }
    
    if (type === 'bool') {
      return 'true or false';
    }
    
    if (type.startsWith('u') || type.startsWith('i')) {
      return `${type} number (e.g., 123)`;
    }
    
    if (type.startsWith('string<')) {
      const match = type.match(/string<(\d+)>/);
      const length = match ? match[1] : 'N';
      return `String (max ${length} chars)`;
    }
    
    if (type.includes('Address') || type === 'AztecAddress') {
      return 'Aztec address (0x1234...abcd)';
    }
    
    if (type.includes('[') && type.includes(']')) {
      return 'JSON array (e.g., [1,2,3])';
    }
    
    if (type.startsWith('(') && type.endsWith(')')) {
      return 'Tuple as JSON (e.g., [1, "text", true])';
    }
    
    if (type === 'struct' || type.includes('struct')) {
      return 'JSON object (e.g., {"field": "value"})';
    }
    
    // Legacy Ethereum types
    switch (type) {
      case 'uint256':
      case 'uint':
      case 'int256':
      case 'int':
        return 'Enter number (e.g., 123)';
      case 'address':
        return '0x1234...abcd';
      case 'bytes':
      case 'bytes32':
        return '0x1234abcd...';
      case 'string':
        return 'Enter text';
      default:
        return `Enter ${type}`;
    }
  };

  return (
    <div className="contract-function">
      <div className="function-header">
        <div className="function-info">
          <h4 className="function-name">{func.name}</h4>
          <div className="function-badges">
            <span className={`function-badge ${func.stateMutability}`}>
              {func.stateMutability}
            </span>
            {isReadFunction && <span className="function-badge read">READ</span>}
            {isPayable && <span className="function-badge payable">PAYABLE</span>}
            {func.is_unconstrained && <span className="function-badge unconstrained">UNCONSTRAINED</span>}
            {func.custom_attributes?.map((attr: string) => (
              <span key={attr} className={`function-badge ${attr.toLowerCase()}`}>
                {attr.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {func.inputs.length > 0 && (
        <div className="function-inputs">
          {func.inputs.map((input, index) => (
            <div key={index} className="input-group">
              <label className="input-label">
                {input.name || `param${index}`}
                <span className="input-type">({input.type})</span>
              </label>
              <input
                type="text"
                className="function-input"
                placeholder={getInputPlaceholder(input.type)}
                value={inputs[input.name] || ''}
                onChange={(e) => handleInputChange(input.name, e.target.value)}
                disabled={isExecuting}
              />
            </div>
          ))}
        </div>
      )}

      <div className="function-actions">
        <button
          className={`execute-button ${isReadFunction ? 'read' : 'write'}`}
          onClick={handleExecute}
          disabled={isExecuting}
        >
          {isExecuting ? 'Executing...' : isReadFunction ? 'Call' : 'Send Transaction'}
        </button>
      </div>

      {result !== null && (
        <div className="function-result success">
          <div className="result-header">
            <span className="result-icon">✅</span>
            <strong>Result:</strong>
          </div>
          <pre className="result-content">
            {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
          </pre>
        </div>
      )}

      {error && (
        <div className="function-result error">
          <div className="result-header">
            <span className="result-icon">❌</span>
            <strong>Error:</strong>
          </div>
          <div className="result-content">{error}</div>
        </div>
      )}
    </div>
  );
};
