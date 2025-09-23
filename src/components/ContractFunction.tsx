import React, { useState, useCallback, useMemo } from 'react';

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
  is_unconstrained?: boolean;
  custom_attributes?: string[];
}

interface ContractFunctionProps {
  func: AbiFunction;
  onExecute: (functionName: string, args: any[]) => Promise<any>;
  isExecuting?: boolean;
}

// Utility functions
const parseInputValue = (value: string, type: string): any => {
  if (!value.trim()) return '';
  
  try {
    if (type === 'field') {
      return value.startsWith('0x') ? value : BigInt(value).toString();
    }
    if (type === 'bool') return value.toLowerCase() === 'true';
    if (type.startsWith('u') || type.startsWith('i')) return BigInt(value).toString();
    if (type.startsWith('string<')) return value;
    if (type.includes('Address') || type === 'AztecAddress') {
      return value.startsWith('0x') ? value : `0x${value}`;
    }
    if (type.includes('[') && type.includes(']')) return JSON.parse(value);
    if (type.startsWith('(') && type.endsWith(')')) return JSON.parse(value);
    if (type === 'struct' || type.includes('struct')) return JSON.parse(value);
    
    // Legacy Ethereum types
    switch (type) {
      case 'uint256': case 'uint': case 'int256': case 'int':
        return BigInt(value).toString();
      case 'address': return value;
      case 'bytes': case 'bytes32':
        return value.startsWith('0x') ? value : `0x${value}`;
      case 'string': return value;
      default: return value;
    }
  } catch (err) {
    throw new Error(`Invalid value for type ${type}: ${value}`);
  }
};

const getInputPlaceholder = (type: string): string => {
  if (type === 'field') return 'Field element (e.g., 123 or 0x1a2b3c...)';
  if (type === 'bool') return 'true or false';
  if (type.startsWith('u') || type.startsWith('i')) return `${type} number (e.g., 123)`;
  if (type.startsWith('string<')) {
    const match = type.match(/string<(\d+)>/);
    return `String (max ${match?.[1] || 'N'} chars)`;
  }
  if (type.includes('Address') || type === 'AztecAddress') return 'Aztec address (0x1234...abcd)';
  if (type.includes('[') && type.includes(']')) return 'JSON array (e.g., [1,2,3])';
  if (type.startsWith('(') && type.endsWith(')')) return 'Tuple as JSON (e.g., [1, "text", true])';
  if (type === 'struct' || type.includes('struct')) return 'JSON object (e.g., {"field": "value"})';
  
  switch (type) {
    case 'uint256': case 'uint': case 'int256': case 'int': return 'Enter number (e.g., 123)';
    case 'address': return '0x1234...abcd';
    case 'bytes': case 'bytes32': return '0x1234abcd...';
    case 'string': return 'Enter text';
    default: return `Enter ${type}`;
  }
};

// Sub-components
const FunctionHeader: React.FC<{ func: AbiFunction; isReadFunction: boolean; isPayable: boolean }> = ({ func, isReadFunction, isPayable }) => (
  <div className="function-header">
    <div className="function-info">
      <h4 className="function-name">{func.name}</h4>
      <div className="function-badges">
        <span className={`function-badge ${func.stateMutability}`}>{func.stateMutability}</span>
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
);

const FunctionInput: React.FC<{
  input: AbiInput;
  index: number;
  value: string;
  onChange: (name: string, value: string) => void;
  disabled: boolean;
}> = ({ input, index, value, onChange, disabled }) => (
  <div className="input-group">
    <label className="input-label">
      {input.name || `param${index}`}
      <span className="input-type">({input.type})</span>
    </label>
    <input
      type="text"
      className="function-input"
      placeholder={getInputPlaceholder(input.type)}
      value={value}
      onChange={(e) => onChange(input.name, e.target.value)}
      disabled={disabled}
    />
  </div>
);

const ResultDisplay: React.FC<{ result: any; error: string | null }> = ({ result, error }) => {
  if (result !== null) {
    return (
      <div className="function-result success">
        <div className="result-header">
          <span className="result-icon">✅</span>
          <strong>Result:</strong>
        </div>
        <pre className="result-content">
          {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
        </pre>
      </div>
    );
  }

  if (error) {
    return (
      <div className="function-result error">
        <div className="result-header">
          <span className="result-icon">❌</span>
          <strong>Error:</strong>
        </div>
        <div className="result-content">{error}</div>
      </div>
    );
  }

  return null;
};

export const ContractFunction: React.FC<ContractFunctionProps> = ({
  func,
  onExecute,
  isExecuting = false
}) => {
  const [inputs, setInputs] = useState<{ [key: string]: string }>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { isReadFunction, isPayable } = useMemo(() => ({
    isReadFunction: func.stateMutability === 'view' || func.stateMutability === 'pure',
    isPayable: func.stateMutability === 'payable'
  }), [func.stateMutability]);

  const handleInputChange = useCallback((inputName: string, value: string) => {
    setInputs(prev => ({ ...prev, [inputName]: value }));
  }, []);

  const handleExecute = useCallback(async () => {
    setError(null);
    setResult(null);

    try {
      const args = func.inputs.map(input => {
        const value = inputs[input.name] || '';
        return parseInputValue(value, input.type);
      });

      const result = await onExecute(func.name, args);
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    }
  }, [func.inputs, func.name, inputs, onExecute]);

  return (
    <div className="contract-function">
      <FunctionHeader func={func} isReadFunction={isReadFunction} isPayable={isPayable} />
      
      {func.inputs.length > 0 && (
        <div className="function-inputs">
          {func.inputs.map((input, index) => (
            <FunctionInput
              key={index}
              input={input}
              index={index}
              value={inputs[input.name] || ''}
              onChange={handleInputChange}
              disabled={isExecuting}
            />
          ))}
        </div>
      )}

      <div className="function-actions">
        <button
          className={`execute-button ${isReadFunction ? 'read' : 'write'}`}
          onClick={handleExecute}
          disabled={isExecuting}
        >
          {isExecuting ? 'Executing...' : (isReadFunction ? 'Call' : 'Send Transaction')}
        </button>
      </div>

      <ResultDisplay result={result} error={error} />
    </div>
  );
};