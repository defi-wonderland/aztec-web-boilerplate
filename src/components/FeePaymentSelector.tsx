/**
 * FeePaymentSelector Component
 *
 * Dropdown for selecting fee payment method.
 */

import React from 'react';
import { Fuel } from 'lucide-react';
import { iconSize } from '../utils';
import { useFeePayment } from '../providers/FeePaymentProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui';
import type { FeePaymentMethodType } from '../config/feePaymentContracts';

interface FeePaymentSelectorProps {
  disabled?: boolean;
  className?: string;
}

export const FeePaymentSelector: React.FC<FeePaymentSelectorProps> = ({
  disabled = false,
  className = '',
}) => {
  const { selectedMethod, setSelectedMethod, availableMethods } =
    useFeePayment();

  // Don't render if only one method available
  if (availableMethods.length <= 1) {
    return null;
  }

  const selectedInfo = availableMethods.find((m) => m.type === selectedMethod);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-default">
          <Fuel size={iconSize()} className="text-muted" />
          <span>Fee Payment</span>
        </div>
        <Select
          value={selectedMethod}
          onValueChange={(value) =>
            setSelectedMethod(value as FeePaymentMethodType)
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-10 w-[220px]">
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
        <p className="text-xs text-muted pl-6">{selectedInfo.description}</p>
      )}
    </div>
  );
};

export default FeePaymentSelector;
