import React, { useState, useRef, useMemo } from 'react';
import {
  AlertTriangle,
  CircleDollarSign,
  Copy,
  Droplets,
  Globe,
  Info,
  Shield,
} from 'lucide-react';
import { useAztecWallet } from '../aztec-wallet';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui';
import {
  useRequiredContracts,
  useToast,
  type LoadingToastResult,
} from '../hooks';
import { useDripper } from '../hooks/mutations/useDripper';
import {
  useTokenBalance,
  type FormattedBalances,
} from '../hooks/queries/useTokenBalance';
import { cn, iconSize } from '../utils';

interface BalanceMetrics {
  privateBalance: bigint;
  publicBalance: bigint;
  totalBalance: bigint;
  privatePercentage: number;
  publicPercentage: number;
}

const calculateBalanceMetrics = (
  formattedBalances: FormattedBalances | null
): BalanceMetrics => {
  const privateBalance = BigInt(formattedBalances?.private ?? '0');
  const publicBalance = BigInt(formattedBalances?.public ?? '0');
  const totalBalance = privateBalance + publicBalance;

  const hasBalance = totalBalance > 0n;
  const calculatePercentage = (balance: bigint) => {
    if (!hasBalance) return 0;
    return Number((balance * 10000n) / totalBalance) / 100;
  };

  const privatePercentage = calculatePercentage(privateBalance);
  const publicPercentage = calculatePercentage(publicBalance);

  return {
    privateBalance,
    publicBalance,
    totalBalance,
    privatePercentage,
    publicPercentage,
  };
};

// Format percentage - ensures we don't show 100% unless it's actually 100%
// and don't show 0% unless it's actually 0%
const formatPercentage = (
  percentage: number,
  balance: bigint,
  total: bigint
): string => {
  // If balance is 0, show 0%
  if (balance === 0n) return '0';
  // If balance equals total, show 100%
  if (balance === total) return '100';
  // Otherwise, cap between <0.01% and >99.99%
  const rounded = Math.round(percentage);
  if (rounded >= 100) return '>99.99';
  if (rounded <= 0) return '<0.01';
  return rounded.toString();
};

// Format balance with full precision (for tooltips)
const formatBalanceFull = (balance: bigint): string => {
  return balance.toLocaleString();
};

// Compact number formatter with suffix (M, B, T, Q)
const formatBalanceCompact = (
  balance: bigint
): { value: string; isCompact: boolean } => {
  const num = Number(balance);

  // Only abbreviate numbers >= 1 million
  const suffixes = [
    { threshold: 1e15, suffix: 'Q', divisor: 1e15 }, // Quadrillion
    { threshold: 1e12, suffix: 'T', divisor: 1e12 }, // Trillion
    { threshold: 1e9, suffix: 'B', divisor: 1e9 }, // Billion
    { threshold: 1e6, suffix: 'M', divisor: 1e6 }, // Million
  ];

  for (const { threshold, suffix, divisor } of suffixes) {
    if (num >= threshold) {
      const value = num / divisor;
      // Show 2 decimal places for cleaner display
      const formatted = value >= 100 ? value.toFixed(1) : value.toFixed(2);
      return { value: `${formatted}${suffix}`, isCompact: true };
    }
  }

  return { value: num.toLocaleString(), isCompact: false };
};

const styles = {
  // Card
  card: 'overflow-hidden',
  cardInner: 'p-0',

  // Token Header
  tokenHeader: 'flex items-center justify-between p-6 border-b border-default',
  tokenLeft: 'flex items-center gap-3.5 min-w-0 flex-1',
  tokenIcon:
    'flex items-center justify-center w-12 h-12 rounded-xl bg-accent shrink-0',
  tokenIconInner: 'text-on-accent',
  tokenInfo: 'flex flex-col gap-0.5 min-w-0',
  tokenName: 'text-lg font-semibold text-default',
  tokenAddress:
    'flex items-center gap-1.5 text-sm text-muted font-mono cursor-pointer hover:text-default transition-colors',
  tokenAddressText: 'break-all',
  copyIcon: 'text-muted shrink-0',

  // Balance Section
  balanceSection: 'p-6 space-y-5',
  totalRow: 'flex items-end justify-between',
  totalLeft: 'flex flex-col gap-1',
  totalLabelRow: 'flex items-center gap-1.5',
  totalLabel: 'text-sm text-muted font-medium',
  totalInfoIcon: 'text-muted cursor-help',
  totalValue:
    'text-5xl font-bold text-default font-mono tracking-tight cursor-help',
  totalUnit: 'text-base text-muted font-medium pb-2',
  breakdownRow: 'flex flex-col sm:flex-row gap-3',
  balanceBox:
    'flex-1 flex items-center justify-between p-3.5 rounded-xl bg-surface',
  balanceBoxLeft: 'flex items-center gap-2.5',
  balanceBoxIcon: {
    private: 'text-accent',
    public: 'text-teal-500',
  },
  balanceBoxLabel: 'text-sm font-medium text-muted',
  balanceBoxValue: 'font-semibold text-default font-mono cursor-help',
  balanceBoxPercent: {
    private:
      'text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    public:
      'text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  },
  balanceBoxRight: 'flex items-center gap-2',
  progressBar:
    'h-1.5 rounded-full bg-teal-100 dark:bg-teal-900/30 overflow-hidden',
  progressFill: 'h-full bg-accent transition-all duration-500',
  syncBadge: 'animate-pulse',

  // Divider
  divider: 'h-px bg-default',

  // Mint Section
  mintSection: 'p-6 space-y-5',
  mintHeader: 'flex items-center justify-between',
  mintTitle: 'text-base font-semibold text-default',
  mintDescription: 'text-sm text-muted',
  mintForm: 'space-y-4',
  inputsRow: 'flex flex-col sm:flex-row gap-3',
  inputField: 'flex-1 space-y-1.5',
  inputLabel: 'text-sm font-medium text-muted',
  amountInputWrapper:
    'flex items-center justify-between h-12 px-4 rounded-xl bg-surface border border-default',
  amountInput:
    'flex-1 bg-transparent border-none outline-none text-default font-normal',
  amountUnit: 'text-sm text-muted font-medium',
  typeToggle: 'flex h-12 p-1 rounded-xl bg-surface border border-default',
  toggleButton: {
    base: 'flex-1 flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
    active: 'bg-accent text-on-accent font-semibold',
    inactive: 'text-muted hover:text-default',
  },
  mintButton: 'w-full',

  // Loading state
  loadingContainer:
    'flex flex-col items-center justify-center py-12 gap-4 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent',
  loadingText: 'text-sm',

  // Balance loading state
  balanceLoadingContainer:
    'flex items-center justify-center gap-3 py-8 text-muted',
  balanceLoadingSpinner:
    'animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent',

  // Error state
  errorContainer: 'text-center py-6',
  errorIcon: 'text-amber-500 mx-auto mb-2',
  errorTitle: 'text-lg font-semibold text-default mb-1',
  errorText: 'text-sm text-muted',
} as const;

// Balance Display Component with Tooltip
interface BalanceDisplayProps {
  balance: bigint;
  className?: string;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  className,
}) => {
  const { value, isCompact } = formatBalanceCompact(balance);
  const fullValue = formatBalanceFull(balance);

  if (!isCompact) {
    return <span className={className}>{value}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{value}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono">{fullValue} TST</span>
      </TooltipContent>
    </Tooltip>
  );
};

// Token Header Component
interface TokenHeaderProps {
  address: string;
  onCopy: () => void;
}

const TokenHeader: React.FC<TokenHeaderProps> = ({ address, onCopy }) => (
  <div className={styles.tokenHeader}>
    <div className={styles.tokenLeft}>
      <div className={styles.tokenIcon}>
        <CircleDollarSign
          size={iconSize('lg')}
          className={styles.tokenIconInner}
        />
      </div>
      <div className={styles.tokenInfo}>
        <span className={styles.tokenName}>Test Token (TST)</span>
        <button
          type="button"
          className={styles.tokenAddress}
          onClick={onCopy}
          aria-label="Copy token address"
        >
          <span className={styles.tokenAddressText}>{address}</span>
          <Copy size={iconSize('xs')} className={styles.copyIcon} />
        </button>
      </div>
    </div>
  </div>
);

// Balance Section Component
interface BalanceSectionProps {
  metrics: BalanceMetrics;
  isLoading: boolean;
  isFetching: boolean;
}

const BalanceSection: React.FC<BalanceSectionProps> = ({
  metrics,
  isLoading,
  isFetching,
}) => {
  const { privateBalance, publicBalance, totalBalance, privatePercentage } =
    metrics;

  if (isLoading) {
    return (
      <div className={styles.balanceSection}>
        <div className={styles.balanceLoadingContainer}>
          <div className={styles.balanceLoadingSpinner} />
          <span>Loading balance...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.balanceSection}>
      {/* Total Balance Row */}
      <div className={styles.totalRow}>
        <div className={styles.totalLeft}>
          <div className={styles.totalLabelRow}>
            <span className={styles.totalLabel}>Total Balance</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={iconSize('xs')} className={styles.totalInfoIcon} />
              </TooltipTrigger>
              <TooltipContent>
                Large numbers are abbreviated (M = Million, B = Billion, T =
                Trillion, Q = Quadrillion). Hover on values to see the full
                amount.
              </TooltipContent>
            </Tooltip>
            {isFetching && (
              <Badge variant="info" className={styles.syncBadge}>
                Syncing
              </Badge>
            )}
          </div>
          <BalanceDisplay
            balance={totalBalance}
            className={styles.totalValue}
          />
        </div>
        <span className={styles.totalUnit}>TST</span>
      </div>

      {/* Private/Public Breakdown */}
      <div className={styles.breakdownRow}>
        {/* Private Balance Box */}
        <div className={styles.balanceBox}>
          <div className={styles.balanceBoxLeft}>
            <Shield
              size={iconSize('md')}
              className={styles.balanceBoxIcon.private}
            />
            <span className={styles.balanceBoxLabel}>Private</span>
          </div>
          <div className={styles.balanceBoxRight}>
            <BalanceDisplay
              balance={privateBalance}
              className={styles.balanceBoxValue}
            />
            {totalBalance > 0n && (
              <span className={styles.balanceBoxPercent.private}>
                {formatPercentage(
                  metrics.privatePercentage,
                  privateBalance,
                  totalBalance
                )}
                %
              </span>
            )}
          </div>
        </div>

        {/* Public Balance Box */}
        <div className={styles.balanceBox}>
          <div className={styles.balanceBoxLeft}>
            <Globe
              size={iconSize('md')}
              className={styles.balanceBoxIcon.public}
            />
            <span className={styles.balanceBoxLabel}>Public</span>
          </div>
          <div className={styles.balanceBoxRight}>
            <BalanceDisplay
              balance={publicBalance}
              className={styles.balanceBoxValue}
            />
            {totalBalance > 0n && (
              <span className={styles.balanceBoxPercent.public}>
                {formatPercentage(
                  metrics.publicPercentage,
                  publicBalance,
                  totalBalance
                )}
                %
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {totalBalance > 0n && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${privatePercentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Mint Type Toggle Component
interface MintTypeToggleProps {
  value: 'private' | 'public';
  onChange: (value: 'private' | 'public') => void;
  disabled?: boolean;
}

const MintTypeToggle: React.FC<MintTypeToggleProps> = ({
  value,
  onChange,
  disabled,
}) => (
  <div className={styles.typeToggle}>
    <button
      type="button"
      className={cn(
        styles.toggleButton.base,
        value === 'private'
          ? styles.toggleButton.active
          : styles.toggleButton.inactive
      )}
      onClick={() => onChange('private')}
      disabled={disabled}
      aria-pressed={value === 'private'}
    >
      <Shield size={iconSize('xs')} />
      <span>Private</span>
    </button>
    <button
      type="button"
      className={cn(
        styles.toggleButton.base,
        value === 'public'
          ? styles.toggleButton.active
          : styles.toggleButton.inactive
      )}
      onClick={() => onChange('public')}
      disabled={disabled}
      aria-pressed={value === 'public'}
    >
      <Globe size={iconSize('xs')} />
      <span>Public</span>
    </button>
  </div>
);

export const DripperCard: React.FC = () => {
  const { account, isPXEInitialized, connectors, connector, currentConfig } =
    useAztecWallet();
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
  const showDripForm = isAnyWalletConnected && isPXEInitialized;

  if (!showDripForm) {
    return null;
  }

  if (contractsHasError) {
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

  if (contractsLoading) {
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
      />

      {/* Balance Section */}
      <BalanceSection
        metrics={metrics}
        isLoading={balanceLoading}
        isFetching={isFetching}
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

          {/* Mint Button */}
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
        </div>
      </div>
    </Card>
  );
};
