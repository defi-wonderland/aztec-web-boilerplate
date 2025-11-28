import React, { useState } from 'react';
import { useAztecWallet, useAzguardWallet } from '../hooks';
import { useTokenContract } from '../hooks/context/useTokenContract';
import { useDripper } from '../hooks/mutations/useDripper';
import { useError } from '../providers/ErrorProvider';

export const DripperCard: React.FC = () => {
  const { connectedAccount, isInitialized, isDeploying } = useAztecWallet();
  const { state: azguardState } = useAzguardWallet();
  const { addError } = useError();
  
  // Get token for address display
  const { token, status: tokenStatus } = useTokenContract();

  const [amount, setAmount] = useState('');
  const [dripType, setDripType] = useState<'private' | 'public'>('private');

  const { dripToPrivate, dripToPublic, isReady } = useDripper({
    onDripToPrivateSuccess: () => {
      addError({
        message: `Successfully minted ${amount} tokens to private balance`,
        type: 'info',
        source: 'dripper',
      });
      setAmount('');
    },
    onDripToPrivateError: (error) => {
      addError({
        message: error.message,
        type: 'error',
        source: 'dripper',
        details:
          'Token minting failed. This might be due to insufficient permissions, network issues, or invalid parameters.',
      });
    },
    onDripToPublicSuccess: () => {
      addError({
        message: `Successfully minted ${amount} tokens to public balance`,
        type: 'info',
        source: 'dripper',
      });
      setAmount('');
    },
    onDripToPublicError: (error) => {
      addError({
        message: error.message,
        type: 'error',
        source: 'dripper',
        details:
          'Token minting failed. This might be due to insufficient permissions, network issues, or invalid parameters.',
      });
    },
  });

  const isProcessing = dripToPrivate.isPending || dripToPublic.isPending;

  const handleDrip = () => {
    if (!amount || !isReady) return;

    const amountBigInt = BigInt(amount);

    if (dripType === 'private') {
      dripToPrivate.mutate({ amount: amountBigInt });
    } else {
      dripToPublic.mutate({ amount: amountBigInt });
    }
  };

  const handleCopyAddress = () => {
    if (token) {
      navigator.clipboard.writeText(token.address.toString());
    }
  };

  // Show dripper form when either wallet is connected and app is initialized
  const isAnyWalletConnected =
    Boolean(connectedAccount) || azguardState.isConnected;
  const showDripForm = isAnyWalletConnected && isInitialized;

  if (!showDripForm) {
    return null;
  }

  // Get contract loading status for UI
  const getContractStatus = () => {
    if (tokenStatus === 'registering') {
      return 'Registering contracts...';
    }
    if (tokenStatus === 'error') {
      return 'Contract registration failed';
    }
    return null;
  };

  const contractStatusMessage = getContractStatus();

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
          {contractStatusMessage && (
            <div className="contract-status">
              <span className="status-icon">⏳</span>
              {contractStatusMessage}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="token-address">Token Address</label>
            <div className="input-with-copy">
              <input
                id="token-address"
                type="text"
                value={token?.address.toString() ?? 'Loading...'}
                readOnly
                className="form-input"
                aria-label="Token contract address"
              />
              <button
                type="button"
                className="copy-button"
                onClick={handleCopyAddress}
                title="Copy to clipboard"
                aria-label="Copy address to clipboard"
                disabled={!token}
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
              disabled={isProcessing || !isReady}
              className="form-input"
              aria-label="Amount to mint"
            />
          </div>

          <div className="form-group">
            <label htmlFor="drip-type">Drip Type</label>
            <select
              id="drip-type"
              value={dripType}
              onChange={(e) =>
                setDripType(e.target.value as 'private' | 'public')
              }
              disabled={isProcessing || !isReady}
              className="form-select"
              aria-label="Select drip type"
            >
              <option value="private">Private Balance</option>
              <option value="public">Public Balance</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleDrip}
            disabled={!amount || isProcessing || isDeploying || !isReady}
            className="btn btn-primary"
            aria-label={`Drip tokens to ${dripType} balance`}
          >
            <span className="btn-icon">
              {dripType === 'private' ? '🛡️' : '🌐'}
            </span>
            {isDeploying
              ? 'Deploying Account...'
              : !isReady
                ? 'Loading Contracts...'
                : isProcessing
                  ? 'Processing...'
                  : `Drip to ${dripType}`}
          </button>
        </div>
      </div>
    </div>
  );
};
