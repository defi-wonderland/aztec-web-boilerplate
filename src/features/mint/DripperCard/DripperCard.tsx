import React, { useState, useRef, useMemo } from 'react';
import { Droplets, AlertTriangle, Wallet } from 'lucide-react';
import { Button, Card, CardContent, Input } from '../../../components/ui';
import { useRequiredContracts } from '../../../hooks';
import { useToast, type LoadingToastResult } from '../../../hooks';
import { iconSize } from '../../../utils';
import { mintFeatureContracts } from '../config/contracts';
import { useDripper } from '../hooks/useDripper';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { TokenHeader, BalanceSection, MintTypeToggle } from './components';
import { styles } from './styles';
import { calculateBalanceMetrics } from './utils';
import type { NetworkConfig } from '../../../config/networks';
import type { ConnectionStatus } from '../../../types/walletConnector';

export interface DripperCardProps {
  isPXEInitialized: boolean;
  isConnected: boolean;
  currentConfig: NetworkConfig;
  connectorStatus: ConnectionStatus | undefined;
  onConnectClick: () => void;
}

export const DripperCard: React.FC<DripperCardProps> = ({
  isPXEInitialized,
  isConnected,
  currentConfig,
  connectorStatus,
  onConnectClick,
}) => {
  const tokenAddress = mintFeatureContracts.token?.address(currentConfig) ?? '';
  const { success, error: toastError, loading } = useToast();
  const {
    formattedBalances,
    isLoading: balanceLoading,
    isFetching,
  } = useTokenBalance();

  const {
    isReady: contractsReady,
    hasError: contractsHasError,
    failedContracts,
  } = useRequiredContracts(['dripper', 'token'] as const);

  const [amount, setAmount] = useState('');
  const [dripType, setDripType] = useState<'private' | 'public'>('private');
  const loadingToastRef = useRef<LoadingToastResult | null>(null);

  const metrics = useMemo(
    () => calculateBalanceMetrics(formattedBalances),
    [formattedBalances]
  );

  const isWalletReady = isConnected && isPXEInitialized;

  const isDataLoading =
    isWalletReady && (!contractsReady || balanceLoading || !formattedBalances);

  const {
    dripToPrivate,
    dripToPublic,
    isPrivatePending,
    isPublicPending,
    isReady,
  } = useDripper({
    onDripToPrivateSuccess: () => {
      loadingToastRef.current?.success(
        'Tokens minted successfully',
        `${amount} tokens added to private balance`
      );
      loadingToastRef.current = null;
      setAmount('');
    },
    onDripToPrivateError: (err) => {
      console.error('Failed to mint tokens to private balance:', err);
      loadingToastRef.current?.error(
        'Minting failed',
        'Failed to mint tokens. Check console for details.'
      );
      loadingToastRef.current = null;
    },
    onDripToPublicSuccess: () => {
      loadingToastRef.current?.success(
        'Tokens minted successfully',
        `${amount} tokens added to public balance`
      );
      loadingToastRef.current = null;
      setAmount('');
    },
    onDripToPublicError: (err) => {
      console.error('Failed to mint tokens to public balance:', err);
      loadingToastRef.current?.error(
        'Minting failed',
        'Failed to mint tokens. Check console for details.'
      );
      loadingToastRef.current = null;
    },
  });
  const isProcessing = isPrivatePending || isPublicPending;
  const isWalletBusy =
    connectorStatus === 'connecting' || connectorStatus === 'deploying';

  const handleDrip = () => {
    if (!amount || !isReady) return;

    loadingToastRef.current = loading(
      'Processing',
      `Minting ${amount} tokens to ${dripType} balance...`
    );

    const amountBigInt = BigInt(amount);

    const dripFn = dripType === 'private' ? dripToPrivate : dripToPublic;
    dripFn({ amount: amountBigInt });
  };

  const handleCopyAddress = () => {
    if (!tokenAddress) {
      toastError('Token address not configured');
      return;
    }

    navigator.clipboard
      .writeText(tokenAddress)
      .then(() => success('Token address copied'))
      .catch(() => toastError('Failed to copy address'));
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

  if (isWalletReady && contractsHasError) {
    return (
      <Card className={styles.card}>
        <CardContent className={styles.errorContainer}>
          <AlertTriangle size={iconSize('2xl')} className={styles.errorIcon} />
          <h3 className={styles.errorTitle}>Contract Registration Failed</h3>
          <p className={styles.errorText}>
            Failed to register: {failedContracts.join(', ')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      {/* TODO: Add token name and symbol from a proper hook (useTokenMetadata)*/}
      <TokenHeader
        address={tokenAddress || 'Not configured'}
        tokenName="Test Token"
        tokenSymbol="TST"
        onCopy={handleCopyAddress}
      />
      {/* Balance Section */}
      <BalanceSection
        metrics={metrics}
        isLoading={isDataLoading}
        isFetching={isFetching}
        isConnected={isWalletReady}
      />

      {/* Divider */}
      <div className={styles.divider} />

      {/* Mint Section */}
      <div className={styles.mintSection} data-testid="dripper-form">
        {/* Mint Header */}
        <div className={styles.mintHeader}>
          <span className={styles.mintTitle}>Mint Tokens</span>
          <span className={styles.mintDescription}>
            Get tokens from the Dripper
          </span>
        </div>

        {/* Mint Form */}
        <div className={styles.mintForm}>
          {/* Amount & Type Row */}
          <div className={styles.inputsRow}>
            {/* Amount Field */}
            <div className={styles.inputField}>
              <label htmlFor="amount" className={styles.inputLabel}>
                Amount
              </label>
              <div className={styles.amountInputWrapper}>
                <Input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="100"
                  disabled={isProcessing || !isReady}
                  className={styles.amountInput}
                />
                <span className={styles.amountUnit}>TST</span>
              </div>
            </div>

            {/* Type Toggle Field */}
            <div className={styles.inputField}>
              <label className={styles.inputLabel}>Type</label>
              <MintTypeToggle
                value={dripType}
                onChange={setDripType}
                disabled={isProcessing || !isReady}
              />
            </div>
          </div>

          {/* Mint / Connect Wallet Button */}
          {!isWalletReady && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onConnectClick}
              icon={<Wallet size={iconSize()} />}
              className={styles.mintButton}
            >
              Connect Wallet
            </Button>
          )}
          {isWalletReady && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleDrip}
              disabled={
                !amount ||
                isProcessing ||
                isWalletBusy ||
                !isReady ||
                !contractsReady
              }
              isLoading={isProcessing}
              icon={<Droplets size={iconSize()} />}
              className={styles.mintButton}
              data-testid="drip-button"
            >
              {isWalletBusy
                ? 'Wallet Busy...'
                : isProcessing
                  ? 'Processing...'
                  : 'Mint'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
