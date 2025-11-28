import React, { useState } from 'react';
import { useAztecWallet, useAzguardWallet, useConfig } from '../hooks';
import {
  useDripToPrivate,
  useDripToPublic,
} from '../hooks/mutations/useDripper';
import { useError } from '../providers/ErrorProvider';

export const DripperCard: React.FC = () => {
  const { connectedAccount, isInitialized, isDeploying } = useAztecWallet();
  const { state: azguardState } = useAzguardWallet();
  const { currentConfig } = useConfig();
  const { addError } = useError();

  const [tokenAddress, setTokenAddress] = useState(
    currentConfig.tokenContractAddress ?? ''
  );
  const [amount, setAmount] = useState('');
  const [dripType, setDripType] = useState<'private' | 'public'>('private');

  const dripToPrivate = useDripToPrivate({
    onSuccess: () => {
      addError({
        message: `Successfully minted ${amount} tokens to private balance`,
        type: 'info',
        source: 'dripper',
      });
      setAmount('');
    },
    onError: (error) => {
      addError({
        message: error.message,
        type: 'error',
        source: 'dripper',
        details:
          'Token minting failed. This might be due to insufficient permissions, network issues, or invalid parameters.',
      });
    },
  });

  const dripToPublic = useDripToPublic({
    onSuccess: () => {
      addError({
        message: `Successfully minted ${amount} tokens to public balance`,
        type: 'info',
        source: 'dripper',
      });
      setAmount('');
    },
    onError: (error) => {
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
    if (!tokenAddress || !amount) return;

    const amountBigInt = BigInt(amount);

    if (dripType === 'private') {
      dripToPrivate.mutate({ tokenAddress, amount: amountBigInt });
    } else {
      dripToPublic.mutate({ tokenAddress, amount: amountBigInt });
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(tokenAddress);
  };

  // Show dripper form when either wallet is connected and app is initialized
  const isAnyWalletConnected =
    Boolean(connectedAccount) || azguardState.isConnected;
  const showDripForm = isAnyWalletConnected && isInitialized;

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
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="Enter token contract address"
                disabled={isProcessing}
                className="form-input"
                aria-label="Token contract address"
              />
              <button
                type="button"
                className="copy-button"
                onClick={handleCopyAddress}
                title="Copy to clipboard"
                aria-label="Copy address to clipboard"
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
              disabled={isProcessing}
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
            disabled={!tokenAddress || !amount || isProcessing || isDeploying}
            className="btn btn-primary"
            aria-label={`Drip tokens to ${dripType} balance`}
          >
            <span className="btn-icon">
              {dripType === 'private' ? '🛡️' : '🌐'}
            </span>
            {isDeploying
              ? 'Deploying Account...'
              : isProcessing
                ? 'Processing...'
                : `Drip to ${dripType}`}
          </button>
        </div>
      </div>
    </div>
  );
};
