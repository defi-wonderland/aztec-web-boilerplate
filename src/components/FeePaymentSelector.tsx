/**
 * FeePaymentSelector Component
 *
 * Controlled dropdown for selecting fee payment method.
 */

import React, { useMemo } from 'react';
import { Fuel, Loader2 } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useUniversalWallet } from '../hooks';
import { useFeeJuiceBalance } from '../hooks/queries/useFeeJuiceBalance';
import { useFeePaymentConfig } from '../hooks/useFeePaymentConfig';
import { hasAppManagedPXE } from '../types/walletConnector';
import { iconSize, cn, formatFeeJuiceBalance } from '../utils';
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
  /** Currently selected fee payment method */
  value: FeePaymentMethodType;
  /** Callback when selection changes */
  onChange: (method: FeePaymentMethodType) => void;
  /** Disable the selector */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export const FeePaymentSelector: React.FC<FeePaymentSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const { connector, currentConfig } = useUniversalWallet();
  const { availableMethods, isSupported } = useFeePaymentConfig();

  // Derive fee payer address synchronously based on selected method
  const feePayerAddress = useMemo(() => {
    if (!connector || !hasAppManagedPXE(connector)) return null;

    switch (value) {
      case 'sponsored':
        return connector.getSponsoredFPCAddress();

      case 'metered':
      case 'meteredExact': {
        const addr = currentConfig?.feePaymentContracts?.metered;
        return addr ? AztecAddress.fromString(addr) : null;
      }

      default:
        return null;
    }
  }, [value, connector, currentConfig?.feePaymentContracts?.metered]);

  // Fetch balance for the fee payer
  const { balance: feeJuiceBalance, isLoading: isLoadingBalance } =
    useFeeJuiceBalance({
      feePayerAddress,
      nodeUrl: currentConfig?.nodeUrl,
      networkName: currentConfig?.name,
      enabled: isSupported && !!feePayerAddress,
    });

  // Don't render if not supported or only one method available
  if (!isSupported || availableMethods.length <= 1) {
    return null;
  }

  const selectedInfo = availableMethods.find((m) => m.type === value);

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.row}>
        <div className={styles.label}>
          <Fuel size={iconSize()} className={styles.labelIcon} />
          <span>Fee Payment</span>
        </div>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
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
