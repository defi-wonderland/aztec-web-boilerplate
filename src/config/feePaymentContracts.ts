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
  | 'fpc' // FPCFeePaymentMethod — generic FPC pay_fee()
  | 'bridged'; // BridgedMintAndPayFeePaymentMethod — requires deposit flow

/**
 * Labels for fee payment methods.
 */
export const FEE_PAYMENT_METHOD_LABELS: Record<FeePaymentMethodType, string> = {
  sponsored: 'Sponsored (Gasless)',
  fpc: 'FPC',
  bridged: 'Bridged FPC',
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
  bridged:
    'Pay from L1-bridged FeeJuice via BridgedFPC (requires deposit flow)',
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

  // Note: `bridged` is intentionally not exposed here. The type + config slot
  // exist for future wiring, but selecting it without a deposit flow would
  // throw at tx time. Add the branch once an L1→L2 claim flow is implemented.

  return methods;
}
