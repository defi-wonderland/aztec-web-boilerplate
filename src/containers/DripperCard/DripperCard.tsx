import React, { useState, useRef, useMemo } from 'react';
import { Droplets, AlertTriangle, Wallet } from 'lucide-react';
import { useAztecWallet, useConnectModal } from '../../aztec-wallet';
import { Button, Card, CardContent } from '../../components/ui';
import {
  useRequiredContracts,
  useToast,
  type LoadingToastResult,
} from '../../hooks';
import { useDripper } from '../../hooks/mutations/useDripper';
import { useTokenBalance } from '../../hooks/queries/useTokenBalance';
import { iconSize } from '../../utils';
import { TokenHeader, BalanceSection, MintTypeToggle } from './components';
import { styles } from './styles';
import { calculateBalanceMetrics } from './utils';

export const DripperCard: React.FC = () => {
  const { account, isPXEInitialized, connectors, connector, currentConfig } =
    useAztecWallet();
  const { open: openConnectModal } = useConnectModal();
  const { success, loading } = useToast();
  const {
    formattedBalances,
    isLoading: balanceLoading,
    isFetching,
  } = useTokenBalance();

  const {
    isReady: contractsReady,
    isLoading: contractsLoading,
    hasError: contractsHasError,
    failedContracts,
    pendingContracts,
  } = useRequiredContracts(['dripper', 'token'] as const);

  const [amount, setAmount] = useState('');
  const [dripType, setDripType] = useState<'private' | 'public'>('private');
  const loadingToastRef = useRef<LoadingToastResult | null>(null);

  const metrics = useMemo(
    () => calculateBalanceMetrics(formattedBalances),
    [formattedBalances]
  );

  const { dripToPrivate, dripToPublic, isReady } = useDripper({
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

  const isProcessing = dripToPrivate.isPending || dripToPublic.isPending;
  const connectorStatus = connector?.getStatus().status;
  const isWalletBusy =
    connectorStatus === 'connecting' || connectorStatus === 'deploying';

  const handleDrip = () => {
    if (!amount || !isReady) return;

    loadingToastRef.current = loading(
      'Processing',
      `Minting ${amount} tokens to ${dripType} balance...`
    );

    const amountBigInt = BigInt(amount);

    if (dripType === 'private') {
      dripToPrivate.mutate({ amount: amountBigInt });
    } else {
      dripToPublic.mutate({ amount: amountBigInt });
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(currentConfig.tokenContractAddress);
    success('Token address copied');
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
    Boolean(account) ||
    connectors.some((conn) => conn.getStatus().status === 'connected');
  const isWalletReady = isAnyWalletConnected && isPXEInitialized;

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

  if (isWalletReady && contractsLoading) {
    return (
      <Card className={styles.card}>
        <CardContent>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>
              Loading contracts: {pendingContracts.join(', ')}...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      {/* Token Header */}
      <TokenHeader
        address={currentConfig.tokenContractAddress}
        onCopy={handleCopyAddress}
        isConnected={isWalletReady}
      />

      {/* Balance Section */}
      <BalanceSection
        metrics={metrics}
        isLoading={balanceLoading}
        isFetching={isFetching}
        isConnected={isWalletReady}
      />

      {/* Divider */}
      <div className={styles.divider} />

      {/* Mint Section */}
      <div className={styles.mintSection}>
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
              <label htmlFor="mint-amount" className={styles.inputLabel}>
                Amount
              </label>
              <div className={styles.amountInputWrapper}>
                <input
                  id="mint-amount"
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
              onClick={openConnectModal}
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
