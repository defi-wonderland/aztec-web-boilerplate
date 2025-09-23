import React, { useState, useRef, useCallback } from 'react';
import { loadContractArtifact } from '@aztec/stdlib/abi';
import type { NoirCompiledContract } from '@aztec/stdlib/noir';

interface ContractArtifact {
  contractName: string;
  abi: any[];
  bytecode?: string;
  address?: string;
  format: 'aztec-noir' | 'unknown';
  metadata?: {
    noir_version?: string;
    transpiled?: boolean;
  };
}

interface ContractLoaderProps {
  onContractLoaded: (contract: ContractArtifact) => void;
}

interface NoirContractArtifact {
  name: string;
  functions: any[];
  transpiled?: boolean;
  noir_version?: string;
  abi?: any[];
  bytecode?: string;
}

// Utility functions
const detectContractFormat = (json: any): 'aztec-noir' | 'pre-formatted-abi' | 'unknown' => {
  if (json.functions && Array.isArray(json.functions) && json.name) return 'aztec-noir';
  if (Array.isArray(json) && json.length > 0 && json[0].type === 'function') return 'pre-formatted-abi';
  if (json.abi && Array.isArray(json.abi) && json.abi.length > 0) return 'pre-formatted-abi';
  return 'unknown';
};

const isEvmContract = (json: any): boolean => (
  json.abi && Array.isArray(json.abi) && 
  !json.functions && 
  (json.contractName || json.metadata?.compiler?.version)
);

const simplifyNoirType = (type: any): string => {
  if (!type) return 'unknown';
  
  switch (type.kind) {
    case 'field': return 'field';
    case 'boolean': return 'bool';
    case 'integer': return `${type.sign === 'unsigned' ? 'u' : 'i'}${type.width}`;
    case 'string': return `string<${type.length}>`;
    case 'array': return `${simplifyNoirType(type.type)}[${type.length}]`;
    case 'slice': return `[${simplifyNoirType(type.type)}]`;
    case 'struct': 
      const pathParts = type.path?.split('::') || [];
      return pathParts[pathParts.length - 1] || 'struct';
    case 'tuple': return `(${type.fields?.map((f: any) => simplifyNoirType(f.type)).join(', ') || ''})`;
    default: return type.kind || 'unknown';
  }
};

const convertNoirContractToAbi = (compiledContract: NoirCompiledContract): any[] => {
  try {
    const contractArtifact = loadContractArtifact(compiledContract);
    
    return contractArtifact.functions.map(func => ({
      name: func.name,
      type: 'function',
      inputs: func.parameters.map(param => ({
        name: param.name,
        type: simplifyNoirType(param.type),
        visibility: param.visibility
      })),
      outputs: func.returnTypes?.map(returnType => ({
        type: simplifyNoirType(returnType.type),
        visibility: returnType.visibility
      })) || [],
      stateMutability: func.isStatic ? 'view' : 'nonpayable',
      isStatic: func.isStatic,
      functionType: func.functionType,
      isInternal: func.isInternal
    }));
  } catch (error) {
    console.warn('Failed to use loadContractArtifact, falling back to manual parsing:', error);
    
    return compiledContract.functions.map(func => {
      const inputs = func.abi?.parameters?.map((param: any) => ({
        name: param.name,
        type: simplifyNoirType(param.type),
        visibility: param.visibility
      })) || [];

      const outputs = func.abi?.return_type ? [{
        type: simplifyNoirType(func.abi.return_type.abi_type),
        visibility: func.abi.return_type.visibility
      }] : [];

      const attributes = func.custom_attributes || [];
      let stateMutability = 'nonpayable';
      
      if (attributes.includes('utility') || attributes.includes('view')) {
        stateMutability = 'view';
      } else if (attributes.includes('initializer') || attributes.includes('constructor')) {
        stateMutability = 'nonpayable';
      } else if (!func.is_unconstrained) {
        stateMutability = 'nonpayable';
      } else if (func.abi?.return_type && (!func.abi?.parameters || func.abi.parameters.length === 0)) {
        stateMutability = 'view';
      }

      return {
        name: func.name,
        type: 'function',
        inputs,
        outputs,
        stateMutability,
        custom_attributes: func.custom_attributes || [],
        is_unconstrained: func.is_unconstrained,
        error_types: func.abi?.error_types || {}
      };
    });
  }
};

const parseNoirContract = (json: NoirContractArtifact, fileName: string): ContractArtifact => {
  const abi = json.abi || convertNoirContractToAbi(json as NoirCompiledContract);
  
  return {
    contractName: json.name || fileName.replace('.json', ''),
    abi,
    bytecode: json.bytecode,
    format: 'aztec-noir',
    metadata: {
      noir_version: json.noir_version,
      transpiled: json.transpiled,
    }
  };
};

const parsePreFormattedAbi = (json: any, fileName: string): ContractArtifact => {
  let abi: any[];
  
  if (Array.isArray(json)) {
    abi = json;
  } else if (json.abi && Array.isArray(json.abi)) {
    abi = json.abi;
  } else {
    throw new Error('Invalid ABI format');
  }
  
  return {
    contractName: json.contractName || json.name || fileName.replace('.json', ''),
    abi,
    bytecode: json.bytecode,
    format: 'aztec-noir',
    metadata: {
      source: 'pre-formatted-abi',
    }
  };
};

// Sub-components
const DropzoneContent: React.FC<{ 
  isLoading: boolean; 
  processingMessage: string | null; 
}> = ({ isLoading, processingMessage }) => {
  if (isLoading) {
    return (
      <div className="contract-loader-content">
        <div className="loading-spinner"></div>
        <p>Loading contract...</p>
        {processingMessage && (
          <small style={{ color: 'var(--accent-primary)', marginTop: '0.5rem', display: 'block' }}>
            ✅ {processingMessage}
          </small>
        )}
      </div>
    );
  }

  return (
    <div className="contract-loader-content">
      <div className="contract-loader-icon">📄</div>
      <h3>Load Contract Artifact</h3>
      <p>Drag & drop a JSON contract file here, or click to browse</p>
      <small>Supports Aztec Noir contract artifacts and pre-formatted ABIs</small>
    </div>
  );
};

const ErrorDisplay: React.FC<{ error: string | null }> = ({ error }) => {
  if (!error) return null;

  return (
    <div className="contract-loader-error">
      <span className="error-icon">⚠️</span>
      {error}
    </div>
  );
};

export const ContractLoader: React.FC<ContractLoaderProps> = ({ onContractLoaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      if (isEvmContract(json)) {
        throw new Error(
          'This appears to be an EVM/Solidity contract.\n\n' +
          'This tool is designed for Aztec Noir contracts only.\n'
        );
      }

      const format = detectContractFormat(json);
      let contract: ContractArtifact;
      
      if (format === 'aztec-noir') {
        setProcessingMessage('Contract artifact received and converted into ABI');
        contract = parseNoirContract(json as NoirContractArtifact, file.name);
      } else if (format === 'pre-formatted-abi') {
        setProcessingMessage('ABI received');
        contract = parsePreFormattedAbi(json, file.name);
      } else {
        if (json.functions && Array.isArray(json.functions)) {
          setProcessingMessage('Contract artifact received and converted into ABI');
          contract = parseNoirContract(json as NoirContractArtifact, file.name);
        } else {
          throw new Error(
            'Unrecognized format.\n\n' +
            'Expected either:\n' +
            '• Aztec Noir contract artifact with "name" and "functions" fields\n' +
            '• Pre-formatted ABI array or object with "abi" property\n\n' +
            'Make sure you\'re loading a valid Aztec contract file.'
          );
        }
      }

      if (!contract.abi || !Array.isArray(contract.abi) || contract.abi.length === 0) {
        throw new Error('Contract must have at least one function in the ABI');
      }

      if (json.address) {
        contract.address = json.address;
      }

      onContractLoaded(contract);
      setTimeout(() => setProcessingMessage(null), 2000);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please check the file format.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to parse contract file');
      }
      setProcessingMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [onContractLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="contract-loader">
      <div
        className={`contract-loader-dropzone ${isDragOver ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        
        <DropzoneContent isLoading={isLoading} processingMessage={processingMessage} />
      </div>
      
      <ErrorDisplay error={error} />
    </div>
  );
};