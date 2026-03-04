/**
 * Fee Payment Constants
 *
 * UI labels, descriptions, and helpers for fee payment methods.
 * Fee payment contract addresses now live in NetworkConfig.feePaymentContracts.
 */

import type { FeePaymentMethodType } from '@use-aztec/types/contractTypes';
import type { DeployedContractConfig } from '../../../config/networks/types';

// Re-export FeePaymentMethodType from use-aztec (canonical source)
export type { FeePaymentMethodType } from '@use-aztec/types/contractTypes';

/**
 * Labels for fee payment methods.
 */
export const FEE_PAYMENT_METHOD_LABELS: Record<FeePaymentMethodType, string> = {
  sponsored: 'Sponsored (Gasless)',
  metered: 'Metered FPC',
  meteredExact: 'Metered FPC (Exact Refund)',
};

/**
 * Descriptions for fee payment methods.
 */
export const FEE_PAYMENT_METHOD_DESCRIPTIONS: Record<
  FeePaymentMethodType,
  string
> = {
  sponsored: 'Transactions are fully sponsored using the built-in Aztec FPC',
  metered: 'Pay from your FPC balance (max gas deducted upfront)',
  meteredExact: 'Pay from your FPC balance with unused gas refunded',
};

/**
 * Get available fee payment methods for a given config.
 */
export function getAvailableFeePaymentMethods(
  config?: Record<string, DeployedContractConfig>
): FeePaymentMethodType[] {
  const methods: FeePaymentMethodType[] = ['sponsored'];

  if (config?.metered?.address) {
    methods.push('metered', 'meteredExact');
  }

  return methods;
}
