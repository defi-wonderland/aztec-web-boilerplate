/**
 * Fee Payment Service
 */

import { FPCFeePaymentMethod } from '@defi-wonderland/aztec-fee-payment/fee-payment-methods';
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

    case 'fpc':
      if (!config.fpc?.address) {
        throw new Error('FPC not configured for this network');
      }
      return new FPCFeePaymentMethod(
        AztecAddress.fromString(config.fpc.address)
      );

    case 'bridged':
      throw new Error(
        'BridgedMintAndPayFeePaymentMethod requires per-deposit params ' +
          '(amount, secret, salt, leafIndex) from an L1→L2 FeeJuice bridge deposit. ' +
          'This boilerplate ships only config plumbing — see ' +
          'defi-wonderland/aztec-feejuice-frontend for a reference deposit + claim flow.'
      );

    default:
      throw new Error(`Unknown fee payment method type: ${type}`);
  }
}
