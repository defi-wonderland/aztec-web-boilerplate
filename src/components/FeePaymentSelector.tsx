/**
 * FeePaymentSelector Component
 *
 * Dropdown for selecting fee payment method.
 */

import React, { useEffect, useState } from 'react';
import { Fuel, Loader2 } from 'lucide-react';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { useUniversalWallet } from '../hooks';
import { useFeeJuiceBalance } from '../hooks/queries/useFeeJuiceBalance';
import { useFeePayment } from '../providers/FeePaymentProvider';
import { hasAppManagedPXE } from '../types/walletConnector';
import { iconSize, cn } from '../utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from './ui';
import type { FeePaymentMethodType } from '../config/feePaymentContracts';

const styles = {
  container: 'flex flex-col gap-2',
  row: 'flex items-center gap-3',
  label: 'flex items-center gap-2 text-sm font-medium text-default',
  labelIcon: 'text-muted',
  trigger: 'h-10 w-[220px]',
  description: 'text-xs text-muted pl-6',
  balanceContainer: 'flex items-center gap-2 pl-6',
  balanceLabel: 'text-xs text-muted',
  balanceValue: 'text-xs font-medium text-default',
  balanceLoading: 'text-xs text-muted flex items-center gap-1',
  loadingIcon: 'animate-spin',
} as const;

interface FeePaymentSelectorProps {
  disabled?: boolean;
  className?: string;
}

/**
 * Formats Fee Juice balance for display.
 * Fee Juice uses 18 decimals.
 */
const formatFeeJuiceBalance = (balance: bigint): string => {
  const decimals = 18n;
  const divisor = 10n ** decimals;
  const whole = balance / divisor;
  const fractional = balance % divisor;

  if (fractional === 0n) {
    return whole.toLocaleString();
  }

  // Show up to 4 decimal places
  const fractionalStr = fractional.toString().padStart(Number(decimals), '0');
  const trimmedFractional = fractionalStr.slice(0, 4).replace(/0+$/, '');

  if (trimmedFractional === '') {
    return whole.toLocaleString();
  }

  return `${whole.toLocaleString()}.${trimmedFractional}`;
};

export const FeePaymentSelector: React.FC<FeePaymentSelectorProps> = ({
  disabled = false,
  className = '',
}) => {
  const {
    selectedMethod,
    setSelectedMethod,
    availableMethods,
    getSelectedFeePayerAddress,
  } = useFeePayment();
  const { connector, currentConfig, isConnected, isInitialized } =
    useUniversalWallet();

  const [feePayerAddress, setFeePayerAddress] = useState<AztecAddress | null>(
    null
  );

  const isReady = isConnected && isInitialized && hasAppManagedPXE(connector);

  // Fetch fee payer address when method changes
  useEffect(() => {
    if (!isReady || !hasAppManagedPXE(connector)) return;

    const fetchFeePayerAddress = async () => {
      const address = await getSelectedFeePayerAddress(
        connector.getSponsoredFeePaymentMethod
      );
      setFeePayerAddress(address);
    };
    fetchFeePayerAddress();
  }, [getSelectedFeePayerAddress, connector, isReady]);

  // Use React Query hook for Fee Juice balance
  const { balance: feeJuiceBalance, isLoading: isLoadingBalance } =
    useFeeJuiceBalance({
      feePayerAddress,
      nodeUrl: currentConfig?.nodeUrl,
      enabled: isReady,
    });

  // Don't render if only one method available
  if (availableMethods.length <= 1) {
    return null;
  }

  const selectedInfo = availableMethods.find((m) => m.type === selectedMethod);

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.row}>
        <div className={styles.label}>
          <Fuel size={iconSize()} className={styles.labelIcon} />
          <span>Fee Payment</span>
        </div>
        <Select
          value={selectedMethod}
          onValueChange={(value) =>
            setSelectedMethod(value as FeePaymentMethodType)
          }
          disabled={disabled}
        >
          <SelectTrigger className={styles.trigger}>
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            {availableMethods.map((method) => (
              <SelectItem key={method.type} value={method.type}>
                {method.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedInfo && (
        <p className={styles.description}>{selectedInfo.description}</p>
      )}
      {feePayerAddress && (
        <div className={styles.balanceContainer}>
          <span className={styles.balanceLabel}>FPC Fee Juice Balance:</span>
          {isLoadingBalance ? (
            <span className={styles.balanceLoading}>
              <Loader2 size={iconSize('xs')} className={styles.loadingIcon} />
              Loading...
            </span>
          ) : feeJuiceBalance !== null ? (
            <Badge variant="info">
              {formatFeeJuiceBalance(feeJuiceBalance)} FJ
            </Badge>
          ) : (
            <span className={styles.balanceValue}>--</span>
          )}
        </div>
      )}
    </div>
  );
};

export default FeePaymentSelector;
