import React, { useEffect } from 'react';
import { Fuel, Info, Loader2 } from 'lucide-react';
import {
  FEE_PAYMENT_METHOD_LABELS,
  FEE_PAYMENT_METHOD_DESCRIPTIONS,
  getAvailableFeePaymentMethods,
} from '../config/feePaymentContracts';
import { useUniversalWallet } from '../hooks';
import { useFeeJuiceBalance } from '../hooks/queries/useFeeJuiceBalance';
import { useFeePayerAddress } from '../hooks/queries/useFeePayerAddress';
import {
  useFeePaymentMethod,
  useSetFeePaymentMethod,
} from '../store/feePayment';
import { hasAppManagedPXE } from '../types/walletConnector';
import { iconSize, cn, formatFeeJuiceBalance } from '../utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from './ui';
import type { FeePaymentMethodType } from '../config/feePaymentContracts';

const styles = {
  container: 'flex flex-col gap-2',
  row: 'flex items-center gap-3',
  label: 'flex items-center gap-2 text-sm font-medium text-default',
  labelIcon: 'text-muted',
  infoIcon: 'text-muted cursor-help',
  trigger: 'h-10 w-[220px]',
  balanceContainer: 'flex items-center gap-2',
  balanceLabel: 'text-xs text-muted',
  balanceValue: 'text-xs font-medium text-default',
  balanceLoading: 'text-xs text-muted flex items-center gap-1',
  loadingIcon: 'animate-spin',
  tooltipContent: 'max-w-xs space-y-2',
  tooltipMethod: 'text-xs',
  tooltipMethodName: 'font-semibold',
} as const;

interface FeePaymentSelectorProps {
  /** Disable the selector */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export const FeePaymentSelector: React.FC<FeePaymentSelectorProps> = ({
  disabled = false,
  className,
}) => {
  const storedMethod = useFeePaymentMethod();
  const setSelectedMethod = useSetFeePaymentMethod();
  const { connector, currentConfig, isConnected, isInitialized } =
    useUniversalWallet();

  const availableMethods = getAvailableFeePaymentMethods(
    currentConfig?.feePaymentContracts
  );

  const selectedMethod: FeePaymentMethodType = availableMethods.includes(
    storedMethod
  )
    ? storedMethod
    : 'sponsored';

  const isReady = isConnected && isInitialized && hasAppManagedPXE(connector);

  useEffect(() => {
    if (selectedMethod !== storedMethod) {
      setSelectedMethod(selectedMethod);
    }
  }, [selectedMethod, storedMethod, setSelectedMethod]);

  const appManagedConnector = hasAppManagedPXE(connector) ? connector : null;

  const { feePayerAddress } = useFeePayerAddress({
    selectedMethod,
    connector: appManagedConnector,
    feePaymentConfig: currentConfig?.feePaymentContracts,
    enabled: isReady,
  });

  // Fetch balance for the fee payer
  const { balance: feeJuiceBalance, isLoading: isLoadingBalance } =
    useFeeJuiceBalance({
      feePayerAddress,
      nodeUrl: currentConfig?.nodeUrl,
      networkName: currentConfig?.name,
      enabled: !!feePayerAddress,
    });

  const isSandbox = currentConfig?.name === 'sandbox';

  // Don't render on sandbox (requires additional contract deployment) or if only one method available
  if (isSandbox || availableMethods.length <= 1) {
    return null;
  }

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.row}>
        <div className={styles.label}>
          <Fuel size={iconSize()} className={styles.labelIcon} />
          <span>Fee Payment</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info size={iconSize()} className={styles.infoIcon} />
            </TooltipTrigger>
            <TooltipContent className={styles.tooltipContent}>
              {availableMethods.map((method) => (
                <p key={method} className={styles.tooltipMethod}>
                  <span className={styles.tooltipMethodName}>
                    {FEE_PAYMENT_METHOD_LABELS[method]}:
                  </span>{' '}
                  {FEE_PAYMENT_METHOD_DESCRIPTIONS[method]}
                </p>
              ))}
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={selectedMethod}
          onValueChange={setSelectedMethod}
          disabled={disabled}
        >
          <SelectTrigger className={styles.trigger}>
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            {availableMethods.map((method) => (
              <SelectItem key={method} value={method}>
                {FEE_PAYMENT_METHOD_LABELS[method]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {feePayerAddress && (
        <div className={styles.balanceContainer}>
          <span className={styles.balanceLabel}>FPC Fee Juice Balance:</span>
          {isLoadingBalance && (
            <span className={styles.balanceLoading}>
              <Loader2 size={iconSize('xs')} className={styles.loadingIcon} />
              Loading...
            </span>
          )}
          {!isLoadingBalance && feeJuiceBalance !== null && (
            <Badge variant="info">
              {formatFeeJuiceBalance(feeJuiceBalance)} FJ
            </Badge>
          )}
          {!isLoadingBalance && feeJuiceBalance === null && (
            <span className={styles.balanceValue}>--</span>
          )}
        </div>
      )}
    </div>
  );
};
