import React, { useState, useCallback, useMemo } from 'react';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
import { NFTContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/NFT.js';
import { AztecAddress } from '@aztec/aztec.js';
import { useAztecWallet } from '../../hooks';
import { useError } from '../../providers/ErrorProvider';
import { AztecContractService } from '../../services/aztec/core/AztecContractService';

export interface ContractDeployerProps {
  /** Callback when a contract is successfully deployed */
  onContractDeployed?: (contractAddress: string, contractType: string, artifact: any) => void;
  /** Whether deployment is disabled */
  disabled?: boolean;
}

interface TokenDeployParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  to: string;
  upgradeAuthority: string;
}

interface NFTDeployParams {
  name: string;
  symbol: string;
  minter: string;
  upgradeAuthority: string;
}

/**
 * Component for deploying Token and NFT contracts from @defi-wonderland/aztec-standards
 * Provides UI for custom initializer parameters
 */
export const ContractDeployer: React.FC<ContractDeployerProps> = ({
  onContractDeployed,
  disabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<'token' | 'nft'>('token');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResults, setDeploymentResults] = useState<Array<{
    id: string;
    type: string;
    address: string;
    timestamp: Date;
    txHash?: string;
  }>>([]);

  // Token deployment parameters
  const [tokenParams, setTokenParams] = useState<TokenDeployParams>({
    name: 'My Token',
    symbol: 'MTK',
    decimals: 18,
    initialSupply: '1000000',
    to: '',
    upgradeAuthority: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  // NFT deployment parameters
  const [nftParams, setNftParams] = useState<NFTDeployParams>({
    name: 'My NFT Collection',
    symbol: 'MNC',
    minter: '',
    upgradeAuthority: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  const { connectedAccount, isInitialized } = useAztecWallet();
  const { addError } = useError();

  const isWalletReady = connectedAccount && isInitialized;

  // Create contract service when wallet is ready
  // TODO: This should ideally come from the wallet context
  const contractService = useMemo(() => {
    if (!connectedAccount) return null;
    
    // For now, we'll need to access PXE from the wallet
    // This is a temporary solution until we expose contract service from context
    try {
      const pxe = (connectedAccount as any).pxe;
      if (pxe) {
        const service = new AztecContractService(pxe, connectedAccount);
        return service;
      }
    } catch (error) {
      console.warn('Could not create contract service:', error);
    }
    return null;
  }, [connectedAccount]);

  // Validation
  const validateTokenParams = useCallback((): string | null => {
    if (!tokenParams.name.trim()) return 'Token name is required';
    if (!tokenParams.symbol.trim()) return 'Token symbol is required';
    if (tokenParams.decimals < 0 || tokenParams.decimals > 18) return 'Decimals must be between 0 and 18';
    if (!tokenParams.initialSupply.trim() || isNaN(Number(tokenParams.initialSupply))) return 'Valid initial supply is required';
    if (!tokenParams.to.trim()) return 'Recipient address is required';
    
    try {
      AztecAddress.fromString(tokenParams.to);
    } catch {
      return 'Invalid recipient address format';
    }

    try {
      AztecAddress.fromString(tokenParams.upgradeAuthority);
    } catch {
      return 'Invalid upgrade authority address format';
    }

    return null;
  }, [tokenParams]);

  const validateNFTParams = useCallback((): string | null => {
    if (!nftParams.name.trim()) return 'NFT name is required';
    if (!nftParams.symbol.trim()) return 'NFT symbol is required';
    if (!nftParams.minter.trim()) return 'Minter address is required';
    
    try {
      AztecAddress.fromString(nftParams.minter);
    } catch {
      return 'Invalid minter address format';
    }

    try {
      AztecAddress.fromString(nftParams.upgradeAuthority);
    } catch {
      return 'Invalid upgrade authority address format';
    }

    return null;
  }, [nftParams]);

  const deployToken = useCallback(async () => {
    if (!isWalletReady || !contractService) {
      addError({
        message: 'Wallet not connected or contract service unavailable',
        type: 'error',
        source: 'contract-deployer'
      });
      return;
    }

    const validationError = validateTokenParams();
    if (validationError) {
      addError({
        message: validationError,
        type: 'error',
        source: 'contract-deployer'
      });
      return;
    }

    setIsDeploying(true);
    try {
      const deploymentResult = await contractService.deployTokenContract({
        name: tokenParams.name,
        symbol: tokenParams.symbol,
        decimals: tokenParams.decimals,
        initialSupply: tokenParams.initialSupply,
        to: AztecAddress.fromString(tokenParams.to),
        upgradeAuthority: AztecAddress.fromString(tokenParams.upgradeAuthority),
      });
      
      const result = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'Token',
        address: deploymentResult.contractAddress,
        timestamp: new Date(),
        txHash: deploymentResult.txHash,
      };

      setDeploymentResults(prev => [result, ...prev]);
      
      addError({
        message: `Token contract deployed successfully at ${deploymentResult.contractAddress.slice(0, 10)}...`,
        type: 'info',
        source: 'contract-deployer'
      });

      if (onContractDeployed) {
        onContractDeployed(deploymentResult.contractAddress, 'Token', TokenContract.artifact);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token deployment failed';
      addError({
        message: errorMessage,
        type: 'error',
        source: 'contract-deployer'
      });
    } finally {
      setIsDeploying(false);
    }
  }, [isWalletReady, contractService, tokenParams, validateTokenParams, addError, onContractDeployed]);

  const deployNFT = useCallback(async () => {
    if (!isWalletReady || !contractService) {
      addError({
        message: 'Wallet not connected or contract service unavailable',
        type: 'error',
        source: 'contract-deployer'
      });
      return;
    }

    const validationError = validateNFTParams();
    if (validationError) {
      addError({
        message: validationError,
        type: 'error',
        source: 'contract-deployer'
      });
      return;
    }

    setIsDeploying(true);
    try {
      const deploymentResult = await contractService.deployNFTContract({
        name: nftParams.name,
        symbol: nftParams.symbol,
        minter: AztecAddress.fromString(nftParams.minter),
        upgradeAuthority: AztecAddress.fromString(nftParams.upgradeAuthority),
      });
      
      const result = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'NFT',
        address: deploymentResult.contractAddress,
        timestamp: new Date(),
        txHash: deploymentResult.txHash,
      };

      setDeploymentResults(prev => [result, ...prev]);
      
      addError({
        message: `NFT contract deployed successfully at ${deploymentResult.contractAddress.slice(0, 10)}...`,
        type: 'info',
        source: 'contract-deployer'
      });

      if (onContractDeployed) {
        onContractDeployed(deploymentResult.contractAddress, 'NFT', NFTContract.artifact);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'NFT deployment failed';
      addError({
        message: errorMessage,
        type: 'error',
        source: 'contract-deployer'
      });
    } finally {
      setIsDeploying(false);
    }
  }, [isWalletReady, contractService, nftParams, validateNFTParams, addError, onContractDeployed]);

  // Auto-fill connected account address
  const fillConnectedAddress = useCallback((field: 'to' | 'minter') => {
    if (!connectedAccount) return;
    
    const address = connectedAccount.getAddress().toString();
    if (field === 'to') {
      setTokenParams(prev => ({ ...prev, to: address }));
    } else if (field === 'minter') {
      setNftParams(prev => ({ ...prev, minter: address }));
    }
  }, [connectedAccount]);

  return (
    <div className="contract-deployer">
      <div className="deployer-header">
        <div className="header-icon">🚀</div>
        <div className="header-content">
          <h2>Deploy Standard Contracts</h2>
          <p>Deploy Token and NFT contracts from @defi-wonderland/aztec-standards</p>
        </div>
      </div>

      {!isWalletReady && (
        <div className="wallet-notice">
          <div className="notice-icon">⚠️</div>
          <div className="notice-content">
            <h3>Wallet Connection Required</h3>
            <p>Please connect your Aztec wallet to deploy contracts.</p>
          </div>
        </div>
      )}

      <div className="deployer-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('token')}
          disabled={disabled}
          className={`tab-button ${activeTab === 'token' ? 'active' : ''}`}
        >
          <span className="tab-icon">🪙</span>
          <span className="tab-title">Token Contract</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('nft')}
          disabled={disabled}
          className={`tab-button ${activeTab === 'nft' ? 'active' : ''}`}
        >
          <span className="tab-icon">🖼️</span>
          <span className="tab-title">NFT Contract</span>
        </button>
      </div>

      <div className="deployer-content">
        {activeTab === 'token' && (
          <div className="token-deployer">
            <h3>Token Contract Parameters</h3>
            <div className="param-grid">
              <div className="form-group">
                <label htmlFor="token-name">
                  Name <span className="required">*</span>
                </label>
                <input
                  id="token-name"
                  type="text"
                  value={tokenParams.name}
                  onChange={(e) => setTokenParams(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Token"
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="token-symbol">
                  Symbol <span className="required">*</span>
                </label>
                <input
                  id="token-symbol"
                  type="text"
                  value={tokenParams.symbol}
                  onChange={(e) => setTokenParams(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  placeholder="MTK"
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="token-decimals">
                  Decimals <span className="required">*</span>
                </label>
                <input
                  id="token-decimals"
                  type="number"
                  min="0"
                  max="18"
                  value={tokenParams.decimals}
                  onChange={(e) => setTokenParams(prev => ({ ...prev, decimals: parseInt(e.target.value) || 0 }))}
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="token-supply">
                  Initial Supply <span className="required">*</span>
                </label>
                <input
                  id="token-supply"
                  type="text"
                  value={tokenParams.initialSupply}
                  onChange={(e) => setTokenParams(prev => ({ ...prev, initialSupply: e.target.value }))}
                  placeholder="1000000"
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="token-to">
                  Recipient Address <span className="required">*</span>
                </label>
                <div className="address-input-group">
                  <input
                    id="token-to"
                    type="text"
                    value={tokenParams.to}
                    onChange={(e) => setTokenParams(prev => ({ ...prev, to: e.target.value }))}
                    placeholder="0x..."
                    disabled={disabled || isDeploying}
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={() => fillConnectedAddress('to')}
                    disabled={disabled || isDeploying || !connectedAccount}
                    className="btn btn-secondary btn-sm"
                  >
                    Use Connected
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="token-upgrade">
                  Upgrade Authority
                </label>
                <input
                  id="token-upgrade"
                  type="text"
                  value={tokenParams.upgradeAuthority}
                  onChange={(e) => setTokenParams(prev => ({ ...prev, upgradeAuthority: e.target.value }))}
                  placeholder="0x0000... (zero address for non-upgradeable)"
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>
            </div>

            <div className="deploy-actions">
              <button
                type="button"
                onClick={deployToken}
                disabled={disabled || isDeploying || !isWalletReady || !contractService}
                className="btn btn-primary deploy-btn"
              >
                {isDeploying ? (
                  <>
                    <span className="btn-icon">⏳</span>
                    Deploying Token...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🚀</span>
                    Deploy Token Contract
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'nft' && (
          <div className="nft-deployer">
            <h3>NFT Contract Parameters</h3>
            <div className="param-grid">
              <div className="form-group">
                <label htmlFor="nft-name">
                  Collection Name <span className="required">*</span>
                </label>
                <input
                  id="nft-name"
                  type="text"
                  value={nftParams.name}
                  onChange={(e) => setNftParams(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My NFT Collection"
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="nft-symbol">
                  Symbol <span className="required">*</span>
                </label>
                <input
                  id="nft-symbol"
                  type="text"
                  value={nftParams.symbol}
                  onChange={(e) => setNftParams(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  placeholder="MNC"
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="nft-minter">
                  Minter Address <span className="required">*</span>
                </label>
                <div className="address-input-group">
                  <input
                    id="nft-minter"
                    type="text"
                    value={nftParams.minter}
                    onChange={(e) => setNftParams(prev => ({ ...prev, minter: e.target.value }))}
                    placeholder="0x..."
                    disabled={disabled || isDeploying}
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={() => fillConnectedAddress('minter')}
                    disabled={disabled || isDeploying || !connectedAccount}
                    className="btn btn-secondary btn-sm"
                  >
                    Use Connected
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="nft-upgrade">
                  Upgrade Authority
                </label>
                <input
                  id="nft-upgrade"
                  type="text"
                  value={nftParams.upgradeAuthority}
                  onChange={(e) => setNftParams(prev => ({ ...prev, upgradeAuthority: e.target.value }))}
                  placeholder="0x0000... (zero address for non-upgradeable)"
                  disabled={disabled || isDeploying}
                  className="form-input"
                />
              </div>
            </div>

            <div className="deploy-actions">
              <button
                type="button"
                onClick={deployNFT}
                disabled={disabled || isDeploying || !isWalletReady || !contractService}
                className="btn btn-primary deploy-btn"
              >
                {isDeploying ? (
                  <>
                    <span className="btn-icon">⏳</span>
                    Deploying NFT...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🚀</span>
                    Deploy NFT Contract
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deployment Results */}
      {deploymentResults.length > 0 && (
        <div className="deployment-results">
          <h3>Recent Deployments</h3>
          <div className="results-list">
            {deploymentResults.slice(0, 5).map((result) => (
              <div key={result.id} className="result-item">
                <div className="result-header">
                  <span className="result-type">{result.type}</span>
                  <span className="result-time">{result.timestamp.toLocaleTimeString()}</span>
                </div>
                <div className="result-address">
                  <code>{result.address}</code>
                </div>
                {result.txHash && (
                  <div className="result-tx">
                    <small>Tx: {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
