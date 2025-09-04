import React, { useState } from 'react';
import { useAztecWallet } from '../hooks';
import { useToken } from '../hooks/context/useToken';
import { useError } from '../providers/ErrorProvider';

export const DripperCard: React.FC = () => {
  const { 
    connectedAccount, 
    isInitialized,
    dripperService,
    isDeploying
  } = useAztecWallet();
  
  const { refreshBalance, currentTokenAddress, setTokenAddress, clearTokenAddress } = useToken();
  const { addError } = useError();
  
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dripType, setDripType] = useState<'private' | 'public'>('private');

  const handleDrip = async () => {
    if (!currentTokenAddress || !amount || !dripperService) return;

    setIsProcessing(true);
    try {
      const amountBigInt = BigInt(amount);
      
      if (dripType === 'private') {
        await dripperService.dripToPrivate(currentTokenAddress, amountBigInt);
      } else {
        await dripperService.dripToPublic(currentTokenAddress, amountBigInt);
      }
      
      // Refresh balance after successful drip
      await refreshBalance();
      
      // Show success message
      addError({
        message: `Successfully minted ${amount} tokens to ${dripType} balance`,
        type: 'info',
        source: 'dripper'
      });
      
      // Clear form after successful drip
      setAmount('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mint tokens';
      addError({
        message: errorMessage,
        type: 'error',
        source: 'dripper',
        details: 'Token minting failed. This might be due to insufficient permissions, network issues, or invalid parameters.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncPrivateState = async () => {
    if (!dripperService) return;

    setIsProcessing(true);
    try {
      await dripperService.syncPrivateState();
      
      // Show success message
      addError({
        message: 'Successfully synced private state',
        type: 'info',
        source: 'dripper'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync private state';
      addError({
        message: errorMessage,
        type: 'error',
        source: 'dripper',
        details: 'Private state synchronization failed. This might be due to network issues or contract problems.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show dripper form only when account is connected and app is initialized
  const showDripForm = !!connectedAccount && isInitialized;

  if (!showDripForm) {
    return null;
  }

  return (
    <div className="dripper-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">💰</span>
        </div>
        <div>
          <h3>Dripper - Mint Tokens</h3>
          <p>Mint new tokens to your balance</p>
        </div>
      </div>

      <div className="mint-form-container">
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="token-address">Token Address</label>
            <div className="input-with-copy">
                          <input
              id="token-address"
              type="text"
              value={currentTokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="Enter token contract address"
              disabled={isProcessing}
              className="form-input"
            />
              <button
                type="button"
                className="copy-button"
                onClick={() => navigator.clipboard.writeText(currentTokenAddress)}
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to mint"
              disabled={isProcessing}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="drip-type">Drip Type</label>
            <select
              id="drip-type"
              value={dripType}
              onChange={(e) => setDripType(e.target.value as 'private' | 'public')}
              disabled={isProcessing}
              className="form-select"
            >
              <option value="private">Private Balance</option>
              <option value="public">Public Balance</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleDrip}
            disabled={!currentTokenAddress || !amount || isProcessing || isDeploying}
            className="btn btn-primary"
          >
            <span className="btn-icon">{dripType === 'private' ? '🛡️' : '🌐'}</span>
            {isDeploying ? 'Deploying Account...' : isProcessing ? 'Processing...' : `Drip to ${dripType}`}
          </button>
        </div>
      </div>

      <div className="sync-section">
        <div className="content-header">
          <div className="icon-container">
            <span className="icon">🛡️</span>
          </div>
          <div>
            <h4>Private State Management</h4>
            <p>Synchronize your private state with the Aztec network</p>
          </div>
        </div>
        <button
          onClick={handleSyncPrivateState}
          disabled={isProcessing || isDeploying}
          className="btn btn-secondary"
        >
          <span className="btn-icon">⚡</span>
          {isDeploying ? 'Deploying Account...' : isProcessing ? 'Processing...' : 'Sync Private State'}
        </button>
      </div>
    </div>
  );
};
