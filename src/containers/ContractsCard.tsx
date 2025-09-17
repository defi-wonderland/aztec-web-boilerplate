import React, { useState } from 'react';
import { ContractLoader, ContractInterface } from '../components';

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

export const ContractsCard: React.FC = () => {
  const [loadedContracts, setLoadedContracts] = useState<ContractArtifact[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractArtifact | null>(null);

  const handleContractLoaded = (contract: ContractArtifact) => {
    setLoadedContracts(prev => [...prev, contract]);
  };

  const handleGenerateInterface = (contract: ContractArtifact) => {
    setSelectedContract(contract);
  };

  const handleCloseInterface = () => {
    setSelectedContract(null);
  };

  return (
    <div className="contracts-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">📄</span>
        </div>
        <div>
          <h3>Contract Interaction</h3>
          <p>Load contract artifacts and interact with deployed contracts</p>
        </div>
      </div>

      <div className="contracts-main">
        <ContractLoader onContractLoaded={handleContractLoaded} />

        {loadedContracts.length > 0 && (
          <div className="loaded-contracts">
            <h3>Loaded Contracts</h3>
            <div className="contracts-list">
              {loadedContracts.map((contract, index) => (
                <div key={index} className="contract-item">
                  <div className="contract-info">
                    <h4 className="contract-name">{contract.contractName}</h4>
                    <p className="contract-details">
                      {contract.abi.length} functions • {contract.format}
                      {contract.metadata?.noir_version && (
                        <span className="contract-version">
                          • Noir {contract.metadata.noir_version}
                        </span>
                      )}
                      {contract.address && (
                        <span className="contract-address">
                          • {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="contract-actions">
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleGenerateInterface(contract)}
                    >
                      Generate Interface
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadedContracts.length === 0 && (
          <div className="contracts-placeholder">
            <div className="placeholder-icon">🔧</div>
            <h3>No Contracts Loaded</h3>
            <p>
              Load a contract artifact above to start interacting with deployed contracts.
              This will generate a dynamic interface based on the contract's ABI.
            </p>
          </div>
        )}

        {selectedContract && (
          <ContractInterface
            contract={selectedContract}
            onClose={handleCloseInterface}
          />
        )}
      </div>
    </div>
  );
};
