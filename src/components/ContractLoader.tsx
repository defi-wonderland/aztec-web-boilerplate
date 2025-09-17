import React, { useState, useRef } from 'react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect contract format based on JSON structure
  const detectContractFormat = (json: any): 'aztec-noir' | 'unknown' => {
    // Aztec Noir contracts have 'functions' array and often 'noir_version'
    if (json.functions && Array.isArray(json.functions) && json.name) {
      return 'aztec-noir';
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

  // Convert Noir functions to simplified ABI format for UI
  const convertNoirFunctionsToAbi = (functions: any[]): any[] => {
    return functions.map(func => {
      // Extract parameters from the nested ABI structure
      const inputs = func.abi?.parameters?.map((param: any) => ({
        name: param.name,
        type: simplifyNoirType(param.type),
        visibility: param.visibility
      })) || [];

      // Extract return type
      const outputs = func.abi?.return_type ? [{
        type: simplifyNoirType(func.abi.return_type.abi_type),
        visibility: func.abi.return_type.visibility
      }] : [];

      // Determine state mutability based on Aztec Noir function properties
      let stateMutability = 'nonpayable'; // Default to write function
      
      // First, check for the official isStatic property (if available)
      if (func.abi?.isStatic === true || func.isStatic === true) {
        // Static functions cannot alter state - they are read functions
        stateMutability = 'view';
      } else if (func.abi?.isStatic === false || func.isStatic === false) {
        // Non-static functions can alter state - they are write functions
        stateMutability = 'nonpayable';
      } else {
        // Fallback logic for contracts without isStatic property
        // Use custom attributes to determine function type
        const attributes = func.custom_attributes || [];
        
        if (attributes.includes('utility') || attributes.includes('view')) {
          // Utility and view functions are read-only
          stateMutability = 'view';
        } else if (attributes.includes('initializer') || attributes.includes('constructor')) {
          // Initializers and constructors are write functions
          stateMutability = 'nonpayable';
        } else if (!func.is_unconstrained) {
          // Private functions (is_unconstrained: false) are typically write functions
          stateMutability = 'nonpayable';
        } else {
          // For unconstrained functions without clear indicators, check return type
          // Functions that only return data without parameters are likely getters
          if (func.abi?.return_type && (!func.abi?.parameters || func.abi.parameters.length === 0)) {
            stateMutability = 'view';
          } else {
            // Default to write function for safety
            stateMutability = 'nonpayable';
          }
        }
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

  // Parse Aztec Noir contract
  const parseNoirContract = (json: NoirContractArtifact, fileName: string): ContractArtifact => {
    const abi = json.abi || convertNoirFunctionsToAbi(json.functions || []);
    
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
        contract = parseNoirContract(json as NoirContractArtifact, file.name);
      } else {
        // Try to extract what we can from unknown format
        if (json.functions && Array.isArray(json.functions)) {
          contract = parseNoirContract(json as NoirContractArtifact, file.name);
        } else {
          throw new Error(
            'Unrecognized Aztec contract format.\n\n' +
            'Expected Aztec Noir contract with:\n' +
            '• "name" field with contract name\n' +
            '• "functions" array with contract functions\n' +
            '• Optional "noir_version" field\n\n' +
            'Make sure you\'re loading a compiled Aztec contract artifact, not a Solidity ABI.'
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
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please check the file format.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to parse contract file');
      }
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
          </div>
        ) : (
          <div className="contract-loader-content">
            <div className="contract-loader-icon">📄</div>
            <h3>Load Contract Artifact</h3>
            <p>Drag & drop a JSON contract file here, or click to browse</p>
            <small>Supports Aztec Noir contract artifacts only</small>
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
