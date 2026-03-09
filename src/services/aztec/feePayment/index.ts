/**
 * Fee Payment Service
 */

import {
  MeteredFeePaymentMethod,
  MeteredExactFeePaymentMethod,
} from '@defi-wonderland/aztec-fee-payment/fee-payment-methods';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import type { FeePaymentMethodType } from './feePaymentMethods';
import type { ContractDeployment } from '../../../config/deployments/types';

export interface FeePaymentContext {
  config: Record<string, ContractDeployment>;
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
