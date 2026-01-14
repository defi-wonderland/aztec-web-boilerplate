/**
 * Fee Payment Service
 */

import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import {
  MeteredFeePaymentMethod,
  MeteredExactFeePaymentMethod,
} from '@aztec-fee-payment/fee-payment-methods';
import type { FeePaymentMethodType } from '../../../config/feePaymentContracts';
import type { FeePaymentContractsConfig } from '../../../config/networks/types';

export interface FeePaymentContext {
  config: FeePaymentContractsConfig;
  getSponsoredFeePaymentMethod: () => Promise<FeePaymentMethod>;
}

/**
 * Creates a fee payment method instance based on the specified type.
 */
export async function createFeePaymentMethod(
  type: FeePaymentMethodType,
  context: FeePaymentContext
): Promise<FeePaymentMethod> {
  const { config, getSponsoredFeePaymentMethod } = context;

  switch (type) {
    case 'sponsored':
      return getSponsoredFeePaymentMethod();

    case 'metered':
      if (!config.metered) {
        throw new Error('Metered FPC not configured for this network');
      }
      return new MeteredFeePaymentMethod(
        AztecAddress.fromString(config.metered)
      );

    case 'meteredExact':
      if (!config.metered) {
        throw new Error('Metered FPC not configured for this network');
      }
      return new MeteredExactFeePaymentMethod(
        AztecAddress.fromString(config.metered)
      );

    default:
      throw new Error(`Unknown fee payment method type: ${type}`);
  }
}
