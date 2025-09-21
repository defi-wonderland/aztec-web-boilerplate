import React, { useState, useCallback, useMemo } from 'react';
import { AztecAddress } from '@aztec/aztec.js';
import { useAztecWallet, useAzguardWallet, useConfig, useAddressUtils, useUniversalWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { WalletType } from '../types/aztec';

// Import the contract artifacts from aztec-standards
import { 
  TokenContract, 
  TokenContractArtifact 
} from '@defi-wonderland/aztec-standards/historical/0.0.0-83476cda/artifacts/artifacts/Token';
import { 
  NFTContract, 
  NFTContractArtifact 
} from '@defi-wonderland/aztec-standards/historical/0.0.0-83476cda/artifacts/artifacts/NFT';

// Unified types
type ContractType = 'token' | 'nft';
type TokenConstructorType = 'with_initial_supply' | 'with_minter';
type MinterType = 'dripper' | 'deployer' | 'custom';
type AirdropType = 'deployer' | 'custom';
type UpgradeabilityType = 'upgradeable' | 'immutable';

// Base interface for common fields
interface BaseDeploymentParams {
  name: string;
  symbol: string;
  upgradeability: UpgradeabilityType;
  upgradeAuthority: string;
}

interface TokenDeploymentParams extends BaseDeploymentParams {
  decimals: number;
  initialSupply?: bigint;
  airdropType?: AirdropType;
  customAirdropAddress?: string;
  minterType?: MinterType;
  customMinter?: string;
}

interface NFTDeploymentParams extends BaseDeploymentParams {
  minterType: MinterType;
  customMinter: string;
}

// Reusable radio option interface
interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

// Reusable RadioGroup component
interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const RadioGroup: React.FC<RadioGroupProps> = ({ 
  name, 
  options, 
  value, 
  onChange, 
  disabled = false,
  className = ''
}) => (
  <div className={className}>
    {options.map((option) => (
      <label key={option.value} className="radio-label">
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <span>{option.label}</span>
        {option.description && <small>{option.description}</small>}
      </label>
    ))}
  </div>
);

export const DeployContractCard: React.FC = () => {
  const { isInitialized } = useAztecWallet();
  const { state: azguardState } = useAzguardWallet();
  const { activeAccount, isConnected, getWalletType } = useUniversalWallet();
  const { currentConfig } = useConfig();
  const { addError } = useError();
  
  const [contractType, setContractType] = useState<ContractType>('token');
  const [tokenConstructorType, setTokenConstructorType] = useState<TokenConstructorType>('with_initial_supply');
  
  // Token deployment parameters
  const [tokenParams, setTokenParams] = useState<TokenDeploymentParams>({
    name: '',
    symbol: '',
    decimals: 18,
    initialSupply: BigInt(0),
    airdropType: 'deployer',
    customAirdropAddress: '',
    minterType: 'dripper',
    customMinter: '',
    upgradeability: 'immutable',
    upgradeAuthority: '0x0000000000000000000000000000000000000000000000000000000000000000'
  });
  
  // NFT deployment parameters  
  const [nftParams, setNftParams] = useState<NFTDeploymentParams>({
    name: '',
    symbol: '',
    minterType: 'deployer',
    customMinter: '',
    upgradeability: 'immutable',
    upgradeAuthority: '0x0000000000000000000000000000000000000000000000000000000000000000'
  });

  const { truncateAddress } = useAddressUtils();

  const [deployedAddress, setDeployedAddress] = useState<string>('');

  const { executeAsync, isLoading: isDeploying } = useAsyncOperation();

  // Memoized values
  const deployerAddress = useMemo(() => 
    activeAccount ? truncateAddress(activeAccount.getAddress().toString()) : 'Connect wallet to see address',
    [activeAccount, truncateAddress]
  );

  const dripperAddress = useMemo(() => 
    truncateAddress(currentConfig.dripperContractAddress),
    [currentConfig.dripperContractAddress, truncateAddress]
  );

  // Unified parameter handlers
  const handleParamChange = useCallback(<T extends TokenDeploymentParams | NFTDeploymentParams>(
    type: 'token' | 'nft',
    field: keyof T,
    value: any
  ) => {
    if (type === 'token') {
      setTokenParams(prev => ({ ...prev, [field]: value }));
    } else {
      setNftParams(prev => ({ ...prev, [field]: value }));
    }
  }, []);

  const handleTokenParamChange = useCallback((field: keyof TokenDeploymentParams, value: any) => {
    handleParamChange('token', field, value);
  }, [handleParamChange]);

  const handleNftParamChange = useCallback((field: keyof NFTDeploymentParams, value: any) => {
    handleParamChange('nft', field, value);
  }, [handleParamChange]);

  // Get current params based on contract type
  const currentParams = useMemo(() => 
    contractType === 'token' ? tokenParams : nftParams,
    [contractType, tokenParams, nftParams]
  );

  // Memoized option arrays
  const tokenConstructorOptions: RadioOption[] = useMemo(() => [
    { value: 'with_initial_supply', label: 'Token with Initial Supply' },
    { value: 'with_minter', label: 'Token with Minter' }
  ], []);

  const airdropOptions: RadioOption[] = useMemo(() => [
    { value: 'deployer', label: 'Deployer Address', description: deployerAddress },
    { value: 'custom', label: 'Custom Address' }
  ], [deployerAddress]);

  const tokenMinterOptions: RadioOption[] = useMemo(() => [
    { value: 'dripper', label: 'Dripper Contract', description: dripperAddress },
    { value: 'deployer', label: 'Deployer Address', description: deployerAddress },
    { value: 'custom', label: 'Custom Address' }
  ], [dripperAddress, deployerAddress]);

  const nftMinterOptions: RadioOption[] = useMemo(() => [
    { value: 'deployer', label: 'Deployer Address', description: deployerAddress },
    { value: 'custom', label: 'Custom Address' }
  ], [deployerAddress]);

  const upgradeabilityOptions: RadioOption[] = useMemo(() => [
    { value: 'immutable', label: 'Immutable' },
    { value: 'upgradeable', label: 'Upgradeable' }
  ], []);

  const deployContract = async () => {
    try {
      const result = await executeAsync(async () => {
        if (!activeAccount) {
          throw new Error('Wallet not connected');
        }

        const walletType = getWalletType();
        const wallet = activeAccount;

        // Check if we're using Azguard wallet
        if (walletType === WalletType.AZGUARD) {
          throw new Error('Contract deployment is not yet supported with Azguard wallet. Please use the embedded wallet for deployment.');
        }
        
        return await deployWithStandardFlow(wallet);
      }, 'deploy contract');

      setDeployedAddress(result.address);
      
      addError({
        message: `Successfully deployed ${result.contractName} at ${result.address}`,
        type: 'info',
        source: 'deployment'
      });
    } catch (error) {
      addError({
        message: error instanceof Error ? error.message : 'Deployment failed',
        type: 'error',
        source: 'deployment',
        details: 'Contract deployment failed. Please check your parameters and try again.'
      });
    }
  };

  // Standard deployment function that works with both embedded and Azguard wallets
  const deployWithStandardFlow = async (wallet: any) => {

      let deployMethod;
      let contractName;

      if (contractType === 'token') {
        contractName = `${tokenParams.name} (${tokenParams.symbol})`;
        
        if (tokenConstructorType === 'with_initial_supply') {
          // Handle airdrop address selection
          let airdropAddress: string;
          
          switch (tokenParams.airdropType) {
            case 'deployer':
              airdropAddress = wallet.getAddress().toString();
              break;
            case 'custom':
              if (!tokenParams.customAirdropAddress) {
                throw new Error('Custom airdrop address is required');
              }
              airdropAddress = tokenParams.customAirdropAddress;
              break;
            default:
              throw new Error('Invalid airdrop type');
          }
          
          const upgradeAuthority = tokenParams.upgradeability === 'immutable' 
            ? AztecAddress.ZERO 
            : (tokenParams.upgradeAuthority === '0x0000000000000000000000000000000000000000000000000000000000000000' 
                ? AztecAddress.fromString(wallet.getAddress().toString()) 
                : AztecAddress.fromString(tokenParams.upgradeAuthority));

          deployMethod = TokenContract.deployWithOpts(
            {
              wallet,
              method: 'constructor_with_initial_supply',
            },
            tokenParams.name,
            tokenParams.symbol,
            tokenParams.decimals,
            tokenParams.initialSupply || BigInt(0),
            AztecAddress.fromString(airdropAddress),
            upgradeAuthority
          );
        } else {
          // Handle minter selection
          let minterAddress: string;
          
          switch (tokenParams.minterType) {
            case 'dripper':
              minterAddress = currentConfig.dripperContractAddress;
              break;
            case 'deployer':
              minterAddress = wallet.getAddress().toString();
              break;
            case 'custom':
              if (!tokenParams.customMinter) {
                throw new Error('Custom minter address is required');
              }
              minterAddress = tokenParams.customMinter;
              break;
            default:
              throw new Error('Invalid minter type');
          }
          
          const upgradeAuthority = tokenParams.upgradeability === 'immutable' 
            ? AztecAddress.ZERO 
            : (tokenParams.upgradeAuthority === '0x0000000000000000000000000000000000000000000000000000000000000000' 
                ? AztecAddress.fromString(wallet.getAddress().toString()) 
                : AztecAddress.fromString(tokenParams.upgradeAuthority));

          deployMethod = TokenContract.deployWithOpts(
            {
              wallet,
              method: 'constructor_with_minter',
            },
            tokenParams.name,
            tokenParams.symbol,
            tokenParams.decimals,
            AztecAddress.fromString(minterAddress),
            upgradeAuthority
          );
        }
      } else {
        // NFT deployment
        contractName = `${nftParams.name} (${nftParams.symbol})`;
        
        // Handle minter selection
        let minterAddress: string;
        
        switch (nftParams.minterType) {
          case 'deployer':
            minterAddress = wallet.getAddress().toString();
            break;
          case 'custom':
            if (!nftParams.customMinter) {
              throw new Error('Custom minter address is required');
            }
            minterAddress = nftParams.customMinter;
            break;
          default:
            throw new Error('Invalid minter type');
        }
        
        const upgradeAuthority = nftParams.upgradeability === 'immutable' 
          ? AztecAddress.ZERO 
          : (nftParams.upgradeAuthority === '0x0000000000000000000000000000000000000000000000000000000000000000' 
              ? AztecAddress.fromString(wallet.getAddress().toString()) 
              : AztecAddress.fromString(nftParams.upgradeAuthority));

        deployMethod = NFTContract.deployWithOpts(
          {
            wallet,
            method: 'constructor_with_minter',
          },
          nftParams.name,
          nftParams.symbol,
          AztecAddress.fromString(minterAddress),
          upgradeAuthority
        );
      }

      // Deploy the contract
      const provenInteraction = await deployMethod.prove();
      const receipt = await provenInteraction.send().wait({ timeout: 120 });
      
      const deployedAddress = receipt.contract.address.toString();
      
        // Register the contract with PXE
        if (contractType === 'token') {
          await wallet.registerContract({
            instance: receipt.contract,
            artifact: TokenContractArtifact,
          });
        } else {
          await wallet.registerContract({
            instance: receipt.contract,
            artifact: NFTContractArtifact,
          });
        }

        return {
          address: deployedAddress,
          contractName,
        };
  };


  const isFormValid = () => {
    if (contractType === 'token') {
      const baseValid = tokenParams.name && tokenParams.symbol;
      
      // Check upgradeability-specific validation
      const upgradeValid = tokenParams.upgradeability === 'immutable' || 
        (tokenParams.upgradeability === 'upgradeable' && tokenParams.upgradeAuthority);
      
      if (tokenConstructorType === 'with_initial_supply') {
        // For initial supply constructor, check if custom airdrop address is provided when needed
        if (tokenParams.airdropType === 'custom') {
          return baseValid && tokenParams.customAirdropAddress && upgradeValid;
        }
        return baseValid && upgradeValid;
      } else {
        // For minter constructor, check if custom minter is provided when needed
        if (tokenParams.minterType === 'custom') {
          return baseValid && tokenParams.customMinter && upgradeValid;
        }
        return baseValid && upgradeValid;
      }
    } else {
      const baseValid = nftParams.name && nftParams.symbol;
      const minterValid = nftParams.minterType === 'deployer' || 
        (nftParams.minterType === 'custom' && nftParams.customMinter);
      const upgradeValid = nftParams.upgradeability === 'immutable' || 
        (nftParams.upgradeability === 'upgradeable' && nftParams.upgradeAuthority);
      return baseValid && minterValid && upgradeValid;
    }
  };

  const showDeployForm = isInitialized && isConnected;

  if (!showDeployForm) {
    return null;
  }

  return (
    <div className="deploy-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">🚀</span>
        </div>
        <div>
          <h3>Deploy Contract</h3>
          <p>Deploy your own Token or NFT contracts</p>
        </div>
      </div>

      <div className="deploy-form-container">
        {/* Contract Type Selection */}
        <div className="form-section">
          <h4>Contract Type</h4>
          <div className="contract-type-selector">
            <button
              type="button"
              className={`contract-type-btn ${contractType === 'token' ? 'active' : ''}`}
              onClick={() => setContractType('token')}
              disabled={isDeploying}
            >
              <span className="contract-icon">🪙</span>
              <span>Token Contract</span>
            </button>
            <button
              type="button"
              className={`contract-type-btn ${contractType === 'nft' ? 'active' : ''}`}
              onClick={() => setContractType('nft')}
              disabled={isDeploying}
            >
              <span className="contract-icon">🖼️</span>
              <span>NFT Contract</span>
            </button>
          </div>
        </div>

        {/* Token Constructor Type Selection */}
        {contractType === 'token' && (
          <div className="form-section">
            <h4>Token Constructor</h4>
            <RadioGroup
              name="tokenConstructor"
              options={tokenConstructorOptions}
              value={tokenConstructorType}
              onChange={(value) => setTokenConstructorType(value as TokenConstructorType)}
              disabled={isDeploying}
              className="constructor-type-selector"
            />
          </div>
        )}

        {/* Airdrop Selection for Token with Initial Supply */}
        {contractType === 'token' && tokenConstructorType === 'with_initial_supply' && (
          <div className="form-section">
            <h4>Airdrop Selection</h4>
            <RadioGroup
              name="airdropType"
              options={airdropOptions}
              value={tokenParams.airdropType || 'deployer'}
              onChange={(value) => handleTokenParamChange('airdropType', value as AirdropType)}
              disabled={isDeploying}
              className="airdrop-type-selector"
            />
          </div>
        )}

        {/* Minter Selection for Token with Minter */}
        {contractType === 'token' && tokenConstructorType === 'with_minter' && (
          <div className="form-section">
            <h4>Minter Selection</h4>
            <RadioGroup
              name="tokenMinterType"
              options={tokenMinterOptions}
              value={tokenParams.minterType || 'dripper'}
              onChange={(value) => handleTokenParamChange('minterType', value as MinterType)}
              disabled={isDeploying}
              className="minter-type-selector"
            />
          </div>
        )}

        {/* NFT Minter Selection */}
        {contractType === 'nft' && (
          <div className="form-section">
            <h4>Minter Selection</h4>
            <RadioGroup
              name="nftMinterType"
              options={nftMinterOptions}
              value={nftParams.minterType}
              onChange={(value) => handleNftParamChange('minterType', value as MinterType)}
              disabled={isDeploying}
              className="minter-type-selector"
            />
          </div>
        )}

        {/* Upgradeability Selection */}
        <div className="form-section">
          <h4>Upgradeability</h4>
          <RadioGroup
            name={`${contractType}Upgradeability`}
            options={upgradeabilityOptions}
            value={currentParams.upgradeability}
            onChange={(value) => {
              if (contractType === 'token') {
                handleTokenParamChange('upgradeability', value as UpgradeabilityType);
              } else {
                handleNftParamChange('upgradeability', value as UpgradeabilityType);
              }
            }}
            disabled={isDeploying}
            className="upgradeability-selector"
          />
        </div>

        {/* Contract Parameters */}
        <div className="form-section">
          <h4>Contract Parameters</h4>
          
          {contractType === 'token' ? (
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="token-name">Token Name</label>
                <input
                  id="token-name"
                  type="text"
                  value={tokenParams.name}
                  onChange={(e) => handleTokenParamChange('name', e.target.value)}
                  placeholder="e.g., My Token"
                  disabled={isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="token-symbol">Token Symbol</label>
                <input
                  id="token-symbol"
                  type="text"
                  value={tokenParams.symbol}
                  onChange={(e) => handleTokenParamChange('symbol', e.target.value)}
                  placeholder="e.g., MTK"
                  disabled={isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="token-decimals">Decimals</label>
                <input
                  id="token-decimals"
                  type="number"
                  value={tokenParams.decimals}
                  onChange={(e) => handleTokenParamChange('decimals', parseInt(e.target.value) || 18)}
                  min="0"
                  max="18"
                  disabled={isDeploying}
                  className="form-input"
                />
              </div>

              {tokenConstructorType === 'with_initial_supply' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="initial-supply">Initial Supply</label>
                    <input
                      id="initial-supply"
                      type="number"
                      value={tokenParams.initialSupply?.toString() || ''}
                      onChange={(e) => handleTokenParamChange('initialSupply', BigInt(e.target.value || '0'))}
                      placeholder="0"
                      disabled={isDeploying}
                      className="form-input"
                    />
                  </div>

                  {tokenParams.airdropType === 'custom' && (
                    <div className="form-group">
                      <label htmlFor="custom-airdrop-address">Custom Airdrop Address</label>
                      <input
                        id="custom-airdrop-address"
                        type="text"
                        value={tokenParams.customAirdropAddress}
                        onChange={(e) => handleTokenParamChange('customAirdropAddress', e.target.value)}
                        placeholder="0x..."
                        disabled={isDeploying}
                        className="form-input"
                      />
                    </div>
                  )}
                </>
              ) : (
                tokenParams.minterType === 'custom' && (
                  <div className="form-group">
                    <label htmlFor="custom-minter-address">Custom Minter Address</label>
                    <input
                      id="custom-minter-address"
                      type="text"
                      value={tokenParams.customMinter}
                      onChange={(e) => handleTokenParamChange('customMinter', e.target.value)}
                      placeholder="0x..."
                      disabled={isDeploying}
                      className="form-input"
                    />
                  </div>
                )
              )}

              {tokenParams.upgradeability === 'upgradeable' && (
                <div className="form-group">
                  <label htmlFor="token-upgrade-authority">Upgrade Authority</label>
                  <input
                    id="token-upgrade-authority"
                    type="text"
                    value={tokenParams.upgradeAuthority}
                    onChange={(e) => handleTokenParamChange('upgradeAuthority', e.target.value)}
                    placeholder="0x... (leave empty to use deployer address)"
                    disabled={isDeploying}
                    className="form-input"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="nft-name">NFT Name</label>
                <input
                  id="nft-name"
                  type="text"
                  value={nftParams.name}
                  onChange={(e) => handleNftParamChange('name', e.target.value)}
                  placeholder="e.g., My NFT Collection"
                  disabled={isDeploying}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="nft-symbol">NFT Symbol</label>
                <input
                  id="nft-symbol"
                  type="text"
                  value={nftParams.symbol}
                  onChange={(e) => handleNftParamChange('symbol', e.target.value)}
                  placeholder="e.g., MNFT"
                  disabled={isDeploying}
                  className="form-input"
                />
              </div>

              {nftParams.minterType === 'custom' && (
                <div className="form-group">
                  <label htmlFor="nft-custom-minter-address">Custom Minter Address</label>
                  <input
                    id="nft-custom-minter-address"
                    type="text"
                    value={nftParams.customMinter}
                    onChange={(e) => handleNftParamChange('customMinter', e.target.value)}
                    placeholder="0x..."
                    disabled={isDeploying}
                    className="form-input"
                  />
                </div>
              )}

              {nftParams.upgradeability === 'upgradeable' && (
                <div className="form-group">
                  <label htmlFor="nft-upgrade-authority">Upgrade Authority</label>
                  <input
                    id="nft-upgrade-authority"
                    type="text"
                    value={nftParams.upgradeAuthority}
                    onChange={(e) => handleNftParamChange('upgradeAuthority', e.target.value)}
                    placeholder="0x... (leave empty to use deployer address)"
                    disabled={isDeploying}
                    className="form-input"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deploy Button */}
        <div className="form-section">
          <button
            type="button"
            className="btn btn-primary deploy-btn"
            onClick={deployContract}
            disabled={!isFormValid() || isDeploying}
          >
            {isDeploying ? (
              <>
                <span className="loading-spinner"></span>
                Deploying Contract...
              </>
            ) : (
              <>
                <span className="deploy-icon">🚀</span>
                Deploy {contractType === 'token' ? 'Token' : 'NFT'} Contract
              </>
            )}
          </button>
        </div>

        {/* Deployment Result */}
        {deployedAddress && (
          <div className="form-section">
            <div className="deployment-result">
              <h4>✅ Contract Deployed Successfully!</h4>
              <div className="deployed-address">
                <label>Contract Address:</label>
                <div className="address-display">
                  <code>{deployedAddress}</code>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => navigator.clipboard.writeText(deployedAddress)}
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
