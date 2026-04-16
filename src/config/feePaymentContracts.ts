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
  | 'fpc'; // FPCFeePaymentMethod — generic FPC pay_fee()
// NOTE: BridgedMintAndPayFeePaymentMethod requires L1 bridge deposit params
// (amount, secret, salt, leafIndex) — needs dedicated UX, not yet implemented.

/**
 * Labels for fee payment methods.
 */
export const FEE_PAYMENT_METHOD_LABELS: Record<FeePaymentMethodType, string> = {
  sponsored: 'Sponsored (Gasless)',
  fpc: 'FPC',
};

/**
 * Descriptions for fee payment methods.
 */
export const FEE_PAYMENT_METHOD_DESCRIPTIONS: Record<
  FeePaymentMethodType,
  string
> = {
  sponsored: 'Transactions are fully sponsored using the built-in Aztec FPC',
  fpc: 'Pay from your FPC balance (max gas deducted upfront)',
};

/**
 * Get available fee payment methods for a given config.
 */
export function getAvailableFeePaymentMethods(
  config?: FeePaymentContractsConfig
): FeePaymentMethodType[] {
  const methods: FeePaymentMethodType[] = ['sponsored'];

  if (config?.fpc?.address) {
    methods.push('fpc');
  }

  return methods;
}
