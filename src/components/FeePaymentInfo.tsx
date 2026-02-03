/**
 * FeePaymentInfo Component
 *
 * Read-only display of the current fee payment method for the connected network.
 */

import React from 'react';
import { Fuel } from 'lucide-react';
import { FEE_PAYMENT_METHOD_LABELS } from '../config/feePaymentContracts';
import { useFeePayment } from '../store/feePayment';
import { iconSize, cn } from '../utils';
import { Badge } from './ui';

const styles = {
  container: 'flex items-center gap-3',
  label: 'flex items-center gap-2 text-sm text-muted',
  labelIcon: 'text-muted',
} as const;

interface FeePaymentInfoProps {
  className?: string;
}

export const FeePaymentInfo: React.FC<FeePaymentInfoProps> = ({
  className,
}) => {
  const { method } = useFeePayment();
  const label = FEE_PAYMENT_METHOD_LABELS[method];

  return (
    <div className={cn(styles.container, className)}>
      <span className={styles.label}>
        <Fuel size={iconSize()} className={styles.labelIcon} />
        Fee Payment:
      </span>
      <Badge variant="default">{label}</Badge>
    </div>
  );
};

export default FeePaymentInfo;
