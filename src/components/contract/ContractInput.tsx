import React, { useState, useCallback, useMemo } from 'react';

export interface ContractInputProps {
  /** Contract loading handler */
  onLoadContract: (address: string, artifact: unknown) => Promise<void>;
  /** Whether contract loading is in progress */
  isLoading?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Recent contracts for quick access */
  recentContracts?: Array<{ address: string; name: string; artifact: unknown }>;
}

/**
 * Component for inputting contract address and artifact JSON
 * Provides the main interface for loading Aztec contracts
 */
export const ContractInput: React.FC<ContractInputProps> = ({
  onLoadContract,
  isLoading = false,
  disabled = false,
  recentContracts = [],
}) => {
  const [contractAddress, setContractAddress] = useState('');
  const [artifactJson, setArtifactJson] = useState('');
  const [errors, setErrors] = useState<{ address?: string; artifact?: string }>({});
  const [selectedRecent, setSelectedRecent] = useState('');

  // Validation patterns
  const addressPattern = /^0x[a-fA-F0-9]{64}$/;

  // Validate inputs
  const validateInputs = useCallback(() => {
    const newErrors: { address?: string; artifact?: string } = {};

    // Validate address
    if (!contractAddress.trim()) {
      newErrors.address = 'Contract address is required';
    } else if (!addressPattern.test(contractAddress.trim())) {
      newErrors.address = 'Invalid Aztec address format (must be 0x followed by 64 hex characters)';
    }

    // Validate artifact
    if (!artifactJson.trim()) {
      newErrors.artifact = 'Contract artifact is required';
    } else {
      try {
        const parsed = JSON.parse(artifactJson);
        if (!parsed.functions || !Array.isArray(parsed.functions)) {
          newErrors.artifact = 'Invalid artifact: must contain a functions array';
        }
      } catch {
        newErrors.artifact = 'Invalid JSON format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [contractAddress, artifactJson, addressPattern]);

  // Handle contract loading
  const handleLoadContract = useCallback(async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      const artifact = JSON.parse(artifactJson);
      await onLoadContract(contractAddress.trim(), artifact);
      
      // Clear form on success
      setContractAddress('');
      setArtifactJson('');
      setSelectedRecent('');
      setErrors({});
    } catch (error) {
      setErrors({
        artifact: error instanceof Error ? error.message : 'Failed to load contract',
      });
    }
  }, [contractAddress, artifactJson, onLoadContract, validateInputs]);

  // Handle recent contract selection
  const handleRecentSelection = useCallback((contractId: string) => {
    if (!contractId) {
      setSelectedRecent('');
      return;
    }

    const contract = recentContracts.find((_, index) => index.toString() === contractId);
    if (contract) {
      setContractAddress(contract.address);
      setArtifactJson(JSON.stringify(contract.artifact, null, 2));
      setSelectedRecent(contractId);
      setErrors({});
    }
  }, [recentContracts]);

  // Load example contract
  const loadExample = useCallback(() => {
    const exampleArtifact = {
      name: "ExampleContract",
      functions: [
        {
          name: "get_balance",
          abi: {
            parameters: [
              { name: "address", type: { kind: "struct", path: "aztec::protocol_types::address::aztec_address::AztecAddress" } }
            ],
            return_type: { kind: "field" }
          },
          is_unconstrained: true
        }
      ]
    };

    setContractAddress('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    setArtifactJson(JSON.stringify(exampleArtifact, null, 2));
    setErrors({});
  }, []);

  const canLoadContract = useMemo(() => 
    contractAddress.trim() && artifactJson.trim() && !isLoading && !disabled,
    [contractAddress, artifactJson, isLoading, disabled]
  );

  return (
    <div className="contract-input">
      <div className="contract-input-header">
        <div className="header-icon">📄</div>
        <div className="header-content">
          <h2>Load Aztec Contract</h2>
          <p>Enter a contract address and its artifact to interact with it</p>
        </div>
      </div>

      <div className="contract-input-body">
        {/* Recent Contracts */}
        {recentContracts.length > 0 && (
          <div className="form-group">
            <label htmlFor="recent-contracts">Recent Contracts</label>
            <select
              id="recent-contracts"
              value={selectedRecent}
              onChange={(e) => handleRecentSelection(e.target.value)}
              disabled={disabled || isLoading}
              className="form-select"
            >
              <option value="">Select a recent contract...</option>
              {recentContracts.map((contract, index) => (
                <option key={index} value={index.toString()}>
                  {contract.name} ({contract.address.slice(0, 10)}...{contract.address.slice(-8)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Contract Address */}
        <div className="form-group">
          <label htmlFor="contract-address">
            Contract Address
            <span className="required">*</span>
          </label>
          <input
            id="contract-address"
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
            disabled={disabled || isLoading}
            className={`form-input ${errors.address ? 'error' : ''}`}
            pattern="^0x[a-fA-F0-9]{64}$"
          />
          {errors.address && (
            <div className="form-error">{errors.address}</div>
          )}
          <div className="form-help">
            64-character hexadecimal address starting with 0x
          </div>
        </div>

        {/* Contract Artifact */}
        <div className="form-group">
          <label htmlFor="contract-artifact">
            Contract Artifact JSON
            <span className="required">*</span>
          </label>
          <textarea
            id="contract-artifact"
            value={artifactJson}
            onChange={(e) => setArtifactJson(e.target.value)}
            placeholder="Paste the contract artifact JSON here..."
            disabled={disabled || isLoading}
            className={`form-textarea artifact-textarea ${errors.artifact ? 'error' : ''}`}
            rows={12}
          />
          {errors.artifact && (
            <div className="form-error">{errors.artifact}</div>
          )}
          <div className="form-help">
            JSON artifact generated during contract compilation
          </div>
        </div>

        {/* Action Buttons */}
        <div className="contract-input-actions">
          <button
            type="button"
            onClick={handleLoadContract}
            disabled={!canLoadContract}
            className="btn btn-primary load-contract-btn"
          >
            {isLoading ? (
              <>
                <span className="btn-icon">⏳</span>
                Loading Contract...
              </>
            ) : (
              <>
                <span className="btn-icon">🚀</span>
                Load Contract
              </>
            )}
          </button>

          <button
            type="button"
            onClick={loadExample}
            disabled={disabled || isLoading}
            className="btn btn-secondary"
          >
            <span className="btn-icon">📋</span>
            Load Example
          </button>
        </div>

        {/* Instructions */}
        <div className="contract-input-instructions">
          <h4>How to get contract artifacts:</h4>
          <ol>
            <li>Compile your Noir contract with <code>nargo compile</code></li>
            <li>Find the JSON artifact in the <code>target/</code> directory</li>
            <li>Copy the entire JSON content and paste it above</li>
            <li>Enter the deployed contract address</li>
          </ol>
          
          <div className="instruction-note">
            <strong>Note:</strong> This tool works with any deployed Aztec contract. 
            You can interact with contracts deployed by others if you have their artifact.
          </div>
        </div>
      </div>
    </div>
  );
};
