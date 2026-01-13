import React, { useState, useRef } from 'react';
import { Coins, Copy, Shield, Globe, AlertTriangle } from 'lucide-react';
import { TokenBalance } from '../components/TokenBalance';
import { useUniversalWallet, useRequiredContracts } from '../hooks';
import { useDripper } from '../hooks/mutations/useDripper';
import { useToast, type LoadingToastResult } from '../hooks';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../components/ui';

const styles = {
  // Header
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'h-8 w-8 text-accent',
  // Form
  formContainer: 'space-y-4',
  formSection: 'space-y-4',
  formGroup: 'space-y-2',
  label: 'block text-sm font-semibold text-default',
  // Input with copy button
  inputWithCopy: 'relative flex w-full',
  inputTokenAddress: 'pr-10 font-mono text-xs',
  copyButtonPosition: 'absolute right-2 top-1/2 -translate-y-1/2',
  copyIcon: 'h-4 w-4',
  // Amount & Type row
  amountTypeRow: 'flex flex-col gap-4 sm:flex-row sm:items-end',
  amountWrapper: 'flex-1',
  dripTypeWrapper: 'w-full sm:w-48',
  // Select item icons
  selectItemContent: 'flex items-center gap-2',
  selectItemIcon: 'h-4 w-4',
  // Button icon
  buttonIcon: 'h-4 w-4',
  // Loading state
  loadingContainer:
    'flex flex-col items-center justify-center py-8 gap-4 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent',
  loadingText: 'text-sm',
  // Error state
  errorContainer: 'text-center py-6',
  errorIcon: 'h-12 w-12 text-amber-500 mx-auto mb-2',
  errorTitle: 'text-lg font-semibold text-default mb-1',
  errorText: 'text-sm text-muted',
} as const;

export const DripperCard: React.FC = () => {
  const { account, isInitialized, connectors, connector, currentConfig } =
    useUniversalWallet();
  const { success, loading } = useToast();

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
      console.error('❌ Failed to mint tokens to private balance:', err);
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
      console.error('❌ Failed to mint tokens to public balance:', err);
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

    // Show persistent loading toast
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
  const showDripForm = isAnyWalletConnected && isInitialized;

  if (!showDripForm) {
    return null;
  }

  if (contractsHasError) {
    return (
      <Card>
        <CardContent className={styles.errorContainer}>
          <AlertTriangle className={styles.errorIcon} />
          <h3 className={styles.errorTitle}>Contract Registration Failed</h3>
          <p className={styles.errorText}>
            Failed to register: {failedContracts.join(', ')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Coins className={styles.headerIcon} />
        <div>
          <CardTitle>Dripper - Mint Tokens</CardTitle>
          <CardDescription>Mint new tokens to your balance</CardDescription>
        </div>
      </CardHeader>

      <CardContent className={styles.formContainer}>
        {contractsLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>
              Loading contracts: {pendingContracts.join(', ')}...
            </p>
          </div>
        ) : (
          <div className={styles.formSection}>
            {/* Token Address - First, so user knows which token */}
            <div className={styles.formGroup}>
              <label htmlFor="token-address" className={styles.label}>
                Token Address
              </label>
              <div className={styles.inputWithCopy}>
                <Input
                  id="token-address"
                  value={currentConfig.tokenContractAddress}
                  readOnly
                  className={styles.inputTokenAddress}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="icon"
                      size="icon"
                      onClick={handleCopyAddress}
                      aria-label="Copy address to clipboard"
                      className={styles.copyButtonPosition}
                    >
                      <Copy className={styles.copyIcon} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy to clipboard</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Balance - Shows current state */}
            <TokenBalance />

            {/* Amount & Drip Type - Side by side on larger screens */}
            <div className={styles.amountTypeRow}>
              <div className={styles.amountWrapper}>
                <Input
                  id="amount"
                  label="Amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount"
                  disabled={isProcessing || !isReady}
                />
              </div>
              <div className={styles.dripTypeWrapper}>
                <div className={styles.formGroup}>
                  <label htmlFor="drip-type" className={styles.label}>
                    Drip Type
                  </label>
                  <Select
                    value={dripType}
                    onValueChange={(value) =>
                      setDripType(value as 'private' | 'public')
                    }
                    disabled={isProcessing || !isReady}
                  >
                    <SelectTrigger id="drip-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">
                        <span className={styles.selectItemContent}>
                          <Shield className={styles.selectItemIcon} /> Private
                        </span>
                      </SelectItem>
                      <SelectItem value="public">
                        <span className={styles.selectItemContent}>
                          <Globe className={styles.selectItemIcon} /> Public
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Submit Button */}
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
              icon={
                dripType === 'private' ? (
                  <Shield className={styles.buttonIcon} />
                ) : (
                  <Globe className={styles.buttonIcon} />
                )
              }
            >
              {isWalletBusy
                ? 'Wallet Busy...'
                : isProcessing
                  ? 'Processing...'
                  : `Drip to ${dripType}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
