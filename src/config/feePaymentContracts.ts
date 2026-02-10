/**
 * Fee Payment Method Configuration
 *
 * Defines available fee payment methods and utilities.
 */

import type { FeePaymentContractsConfig } from './networks/types';

/**
 * Fee payment method types available in the application.
 */
export type FeePaymentMethodType =
  | 'sponsored' // Built-in Aztec SponsoredFeePaymentMethod
  | 'metered' // MeteredFeePaymentMethod from aztec-fee-payment
  | 'meteredExact'; // MeteredExactFeePaymentMethod with gas refund

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
  config?: FeePaymentContractsConfig
): FeePaymentMethodType[] {
  const methods: FeePaymentMethodType[] = ['sponsored'];

  if (config?.metered?.address) {
    methods.push('metered', 'meteredExact');
  }

  return methods;
}
