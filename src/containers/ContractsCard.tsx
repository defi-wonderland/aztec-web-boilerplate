import React, { useState, useCallback } from 'react';
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

// Sub-components
const ContentHeader: React.FC = () => (
  <div className="content-header">
    <div className="icon-container">
      <span className="icon">📄</span>
    </div>
    <div>
      <h3>Contract Interaction</h3>
      <p>Load contract artifacts and interact with deployed contracts</p>
    </div>
  </div>
);

const ContractItem: React.FC<{
  contract: ContractArtifact;
  onGenerateInterface: (contract: ContractArtifact) => void;
}> = ({ contract, onGenerateInterface }) => (
  <div className="contract-item">
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
        onClick={() => onGenerateInterface(contract)}
      >
        Generate Interface
      </button>
    </div>
  </div>
);

const LoadedContracts: React.FC<{
  contracts: ContractArtifact[];
  onGenerateInterface: (contract: ContractArtifact) => void;
}> = ({ contracts, onGenerateInterface }) => {
  if (contracts.length === 0) return null;

  return (
    <div className="loaded-contracts">
      <h3>Loaded Contracts</h3>
      <div className="contracts-list">
        {contracts.map((contract, index) => (
          <ContractItem
            key={index}
            contract={contract}
            onGenerateInterface={onGenerateInterface}
          />
        ))}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="contracts-placeholder">
    <div className="placeholder-icon">🔧</div>
    <h3>No Contracts Loaded</h3>
    <p>
      Load a contract artifact above to start interacting with deployed contracts.
      This will generate a dynamic interface based on the contract's ABI.
    </p>
  </div>
);

export const ContractsCard: React.FC = () => {
  const [loadedContracts, setLoadedContracts] = useState<ContractArtifact[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractArtifact | null>(null);

  const handleContractLoaded = useCallback((contract: ContractArtifact) => {
    setLoadedContracts(prev => [...prev, contract]);
  }, []);

  const handleGenerateInterface = useCallback((contract: ContractArtifact) => {
    setSelectedContract(contract);
  }, []);

  const handleCloseInterface = useCallback(() => {
    setSelectedContract(null);
  }, []);

  return (
    <div className="contracts-content">
      <ContentHeader />

      <div className="contracts-main">
        <ContractLoader onContractLoaded={handleContractLoaded} />

        <LoadedContracts 
          contracts={loadedContracts} 
          onGenerateInterface={handleGenerateInterface} 
        />

        {loadedContracts.length === 0 && <EmptyState />}

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