import React, { useState, useRef } from 'react';
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

// Aztec Noir contract structure
interface NoirContractArtifact {
  name: string;
  functions: any[];
  transpiled?: boolean;
  noir_version?: string;
  abi?: any[];
  bytecode?: string;
}

export const ContractLoader: React.FC<ContractLoaderProps> = ({ onContractLoaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect contract format based on JSON structure
  const detectContractFormat = (json: any): 'aztec-noir' | 'pre-formatted-abi' | 'unknown' => {
    // Aztec Noir contracts have 'functions' array and often 'noir_version'
    if (json.functions && Array.isArray(json.functions) && json.name) {
      return 'aztec-noir';
    }
    
    // Pre-formatted ABI is just an array of function definitions
    if (Array.isArray(json) && json.length > 0 && json[0].type === 'function') {
      return 'pre-formatted-abi';
    }
    
    // Object with 'abi' property containing function array
    if (json.abi && Array.isArray(json.abi) && json.abi.length > 0) {
      return 'pre-formatted-abi';
    }
    
    return 'unknown';
  };

  // Check if this looks like an EVM/Solidity contract
  const isEvmContract = (json: any): boolean => {
    return (
      json.abi && Array.isArray(json.abi) && 
      !json.functions && 
      (json.contractName || json.metadata?.compiler?.version)
    );
  };

  // Convert Noir compiled contract to standard Aztec ABI using official tooling
  const convertNoirContractToAbi = (compiledContract: NoirCompiledContract): any[] => {
    try {
      // Use Aztec's official loadContractArtifact to get proper ABI format
      const contractArtifact = loadContractArtifact(compiledContract);
      
      // The contractArtifact.functions array now contains proper ABI entries
      // with isStatic, parameters, returnTypes, etc.
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
        // Use the proper isStatic property from the converted ABI
        stateMutability: func.isStatic ? 'view' : 'nonpayable',
        // Preserve original attributes for debugging/display
        isStatic: func.isStatic,
        functionType: func.functionType,
        isInternal: func.isInternal
      }));
    } catch (error) {
      console.warn('Failed to use loadContractArtifact, falling back to manual parsing:', error);
      
      // Fallback to manual parsing if loadContractArtifact fails
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

        // Fallback logic for manual parsing
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

  // Simplify complex Noir types for UI display
  const simplifyNoirType = (type: any): string => {
    if (!type) return 'unknown';
    
    switch (type.kind) {
      case 'field':
        return 'field';
      case 'boolean':
        return 'bool';
      case 'integer':
        return `${type.sign === 'unsigned' ? 'u' : 'i'}${type.width}`;
      case 'string':
        return `string<${type.length}>`;
      case 'array':
        return `${simplifyNoirType(type.type)}[${type.length}]`;
      case 'slice':
        return `[${simplifyNoirType(type.type)}]`;
      case 'struct':
        // Extract the struct name from the path
        const pathParts = type.path?.split('::') || [];
        return pathParts[pathParts.length - 1] || 'struct';
      case 'tuple':
        return `(${type.fields?.map((f: any) => simplifyNoirType(f.type)).join(', ') || ''})`;
      default:
        return type.kind || 'unknown';
    }
  };

  // Parse Aztec Noir contract using official Aztec tooling
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

  // Parse pre-formatted ABI
  const parsePreFormattedAbi = (json: any, fileName: string): ContractArtifact => {
    let abi: any[];
    
    if (Array.isArray(json)) {
      // Direct ABI array
      abi = json;
    } else if (json.abi && Array.isArray(json.abi)) {
      // Object with 'abi' property
      abi = json.abi;
    } else {
      throw new Error('Invalid ABI format');
    }
    
    return {
      contractName: json.contractName || json.name || fileName.replace('.json', ''),
      abi,
      bytecode: json.bytecode,
      format: 'aztec-noir', // Treat as Aztec format for UI purposes
      metadata: {
        source: 'pre-formatted-abi',
      }
    };
  };


  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      // Check if this is an EVM contract first
      if (isEvmContract(json)) {
        throw new Error(
          'This appears to be an EVM/Solidity contract.\n\n' +
          'This tool is designed for Aztec Noir contracts only.\n'
        );
      }

      // Detect contract format
      const format = detectContractFormat(json);
      
      let contract: ContractArtifact;
      
      if (format === 'aztec-noir') {
        setProcessingMessage('Contract artifact received and converted into ABI');
        contract = parseNoirContract(json as NoirContractArtifact, file.name);
      } else if (format === 'pre-formatted-abi') {
        setProcessingMessage('ABI received');
        contract = parsePreFormattedAbi(json, file.name);
      } else {
        // Try to extract what we can from unknown format
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

      // Validate that we have a usable ABI
      if (!contract.abi || !Array.isArray(contract.abi) || contract.abi.length === 0) {
        throw new Error('Contract must have at least one function in the ABI');
      }

      // Add address if provided in the JSON
      if (json.address) {
        contract.address = json.address;
      }

      onContractLoaded(contract);
      
      // Clear processing message after a short delay to show success
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
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

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
        
        {isLoading ? (
          <div className="contract-loader-content">
            <div className="loading-spinner"></div>
            <p>Loading contract...</p>
            {processingMessage && (
              <small style={{ color: 'var(--accent-primary)', marginTop: '0.5rem', display: 'block' }}>
                ✅ {processingMessage}
              </small>
            )}
          </div>
        ) : (
          <div className="contract-loader-content">
            <div className="contract-loader-icon">📄</div>
            <h3>Load Contract Artifact</h3>
            <p>Drag & drop a JSON contract file here, or click to browse</p>
            <small>Supports Aztec Noir contract artifacts and pre-formatted ABIs</small>
          </div>
        )}
      </div>
      
      {error && (
        <div className="contract-loader-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}
    </div>
  );
};
