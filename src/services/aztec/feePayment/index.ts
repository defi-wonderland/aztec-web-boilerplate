/**
 * Fee Payment Service
 */

import {
  MeteredFeePaymentMethod,
  MeteredExactFeePaymentMethod,
} from '@defi-wonderland/aztec-fee-payment/src/ts/dist/fee-payment-methods';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
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
      if (!config.metered?.address) {
        throw new Error('Metered FPC not configured for this network');
      }
      return new MeteredFeePaymentMethod(
        AztecAddress.fromString(config.metered.address)
      );

    case 'meteredExact':
      if (!config.metered?.address) {
        throw new Error('Metered FPC not configured for this network');
      }
      return new MeteredExactFeePaymentMethod(
        AztecAddress.fromString(config.metered.address)
      );

    default:
      throw new Error(`Unknown fee payment method type: ${type}`);
  }
}
