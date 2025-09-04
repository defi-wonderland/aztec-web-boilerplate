import React from 'react';
import { AztecContractMetadata } from '../../types';

export interface ContractInfoPanelProps {
  /** Contract metadata */
  contractMetadata: AztecContractMetadata;
  /** Contract address */
  contractAddress: string;
  /** Current network */
  network?: 'sandbox' | 'testnet';
  /** Whether the contract is verified */
  isVerified?: boolean;
}

/**
 * Panel displaying contract information and metadata
 * Shows contract details, function counts, and network info
 */
export const ContractInfoPanel: React.FC<ContractInfoPanelProps> = ({
  contractMetadata,
  contractAddress,
  network = 'sandbox',
  isVerified = false,
}) => {
  const functionStats = {
    total: contractMetadata.functions.length,
    private: contractMetadata.privateFunctions.length,
    public: contractMetadata.publicFunctions.length,
    unconstrained: contractMetadata.unconstrainedFunctions.length,
    initializers: contractMetadata.initializers.length,
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const getNetworkColor = () => {
    switch (network) {
      case 'testnet': return '#3b82f6';
      case 'sandbox': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getNetworkIcon = () => {
    switch (network) {
      case 'testnet': return '🌐';
      case 'sandbox': return '🏗️';
      default: return '📡';
    }
  };

  return (
    <div className="contract-info-panel">
      <div className="contract-info-header">
        <div className="contract-status-bar">
          <div className="status-item network-status">
            <span className="status-icon" style={{ color: getNetworkColor() }}>
              {getNetworkIcon()}
            </span>
            <span className="status-text">{network}</span>
          </div>
          
          <div className={`status-item verification-status ${isVerified ? 'verified' : 'unverified'}`}>
            <span className="status-icon">
              {isVerified ? '✅' : '❓'}
            </span>
            <span className="status-text">
              {isVerified ? 'Verified' : 'Unverified'}
            </span>
          </div>
        </div>
      </div>

      <div className="contract-info-body">
        {/* Contract Identity */}
        <div className="info-section">
          <h3 className="section-title">
            <span className="section-icon">📄</span>
            Contract Information
          </h3>
          
          <div className="info-grid">
            <div className="info-item">
              <label>Name</label>
              <span className="contract-name">{contractMetadata.name}</span>
            </div>
            
            <div className="info-item">
              <label>Address</label>
              <div className="contract-address">
                <code>{formatAddress(contractAddress)}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(contractAddress)}
                  className="copy-btn"
                  title="Copy full address"
                >
                  📋
                </button>
              </div>
            </div>
            
            <div className="info-item">
              <label>Noir Version</label>
              <span className="noir-version">{contractMetadata.noirVersion}</span>
            </div>
            
            {contractMetadata.isTranspiled && (
              <div className="info-item">
                <label>Compilation</label>
                <span className="transpiled-badge">Transpiled</span>
              </div>
            )}
          </div>
        </div>

        {/* Function Statistics */}
        <div className="info-section">
          <h3 className="section-title">
            <span className="section-icon">🔧</span>
            Function Overview
          </h3>
          
          <div className="function-stats">
            <div className="stat-item total">
              <div className="stat-number">{functionStats.total}</div>
              <div className="stat-label">Total Functions</div>
            </div>
            
            {functionStats.private > 0 && (
              <div className="stat-item private">
                <div className="stat-icon">🔒</div>
                <div className="stat-number">{functionStats.private}</div>
                <div className="stat-label">Private</div>
              </div>
            )}
            
            {functionStats.public > 0 && (
              <div className="stat-item public">
                <div className="stat-icon">🌐</div>
                <div className="stat-number">{functionStats.public}</div>
                <div className="stat-label">Public</div>
              </div>
            )}
            
            {functionStats.unconstrained > 0 && (
              <div className="stat-item unconstrained">
                <div className="stat-icon">⚡</div>
                <div className="stat-number">{functionStats.unconstrained}</div>
                <div className="stat-label">View</div>
              </div>
            )}
            
            {functionStats.initializers > 0 && (
              <div className="stat-item initializers">
                <div className="stat-icon">🚀</div>
                <div className="stat-number">{functionStats.initializers}</div>
                <div className="stat-label">Initializers</div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Info */}
        <div className="info-section">
          <h3 className="section-title">
            <span className="section-icon">ℹ️</span>
            Quick Info
          </h3>
          
          <div className="quick-info">
            <div className="info-tip">
              <strong>Private Functions:</strong> Execute with zero-knowledge proofs, 
              keeping inputs and logic private while proving correctness.
            </div>
            
            <div className="info-tip">
              <strong>Public Functions:</strong> Execute transparently on the Aztec network, 
              similar to Ethereum smart contracts.
            </div>
            
            <div className="info-tip">
              <strong>View Functions:</strong> Read-only functions that don't modify state. 
              These are fast and don't require transactions.
            </div>
            
            {functionStats.initializers > 0 && (
              <div className="info-tip">
                <strong>Initializers:</strong> Special functions for contract setup. 
                Can only be called once during deployment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
