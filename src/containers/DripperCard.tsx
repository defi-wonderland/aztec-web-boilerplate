import React, { useState } from 'react';
import { useUniversalWallet, useRequiredContracts } from '../hooks';
import { useDripper } from '../hooks/mutations/useDripper';
import { useError } from '../providers/ErrorProvider';
import { TokenBalance } from '../components/TokenBalance';

export const DripperCard: React.FC = () => {
  const { account, isInitialized, connectors, connector, currentConfig } = useUniversalWallet();
  const { addError } = useError();

  const {
    isReady: contractsReady,
    isLoading: contractsLoading,
    hasError: contractsHasError,
    failedContracts,
    pendingContracts,
  } = useRequiredContracts(['dripper', 'token'] as const);

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
  const connectorStatus = connector?.getStatus().status;
  const isWalletBusy = connectorStatus === 'connecting' || connectorStatus === 'deploying';

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
    navigator.clipboard.writeText(currentConfig.tokenContractAddress);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value === '') {
      setAmount('');
      return;
    }

    const isValidPositiveInteger = /^\d+$/.test(value);

    if (isValidPositiveInteger) {
      setAmount(value);
    }
  };

  const isAnyWalletConnected =
    Boolean(account) || connectors.some((conn) => conn.getStatus().status === 'connected');
  const showDripForm = isAnyWalletConnected && isInitialized;

  if (!showDripForm) {
    return null;
  }

  if (contractsHasError) {
    return (
      <div className="dripper-content">
        <div className="content-header">
          <div className="icon-container">
            <span className="icon">⚠️</span>
          </div>
          <div>
            <h3>Contract Registration Failed</h3>
            <p>Failed to register: {failedContracts.join(', ')}</p>
          </div>
        </div>
      </div>
    );
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
        {contractsLoading ? (
          <div className="form-section">
            <div className="flex flex-col items-center justify-center py-2rem gap-1rem opacity-70">
              <div className="animate-spin rounded-full h-2rem w-2rem border-b-2 border-current" />
              <p className="text-0.875rem">
                Loading contracts: {pendingContracts.join(', ')}...
              </p>
            </div>
          </div>
        ) : (
          <>
            <TokenBalance />

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="token-address">Token Address</label>
                <div className="input-with-copy">
                  <input
                    id="token-address"
                    type="text"
                    value={currentConfig.tokenContractAddress}
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
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="amount">Amount</label>
                <input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
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
                disabled={!amount || isProcessing || isWalletBusy || !isReady || !contractsReady}
                className="btn btn-primary"
                aria-label={`Drip tokens to ${dripType} balance`}
              >
                <span className="btn-icon">
                  {dripType === 'private' ? '🛡️' : '🌐'}
                </span>
                {isWalletBusy
                  ? 'Wallet Busy...'
                  : isProcessing
                    ? 'Processing...'
                    : `Drip to ${dripType}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
