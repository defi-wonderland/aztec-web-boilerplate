/**
 * Fee Payment Store Selectors
 *
 * Hook selectors for accessing fee payment state per network.
 */

import { useAztecWallet } from '../../aztec-wallet';
import { useFeePaymentStore, DEFAULT_FEE_PAYMENT_METHOD } from './store';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';
import type { AztecNetwork } from '../../config/networks';

/**
 * Returns the fee payment method for a specific network.
 * @param networkOverride - If provided, uses this network instead of connected network
 */
export const useFeePayment = (networkOverride?: AztecNetwork) => {
  const { currentConfig } = useAztecWallet();
  const networkName = networkOverride ?? currentConfig?.name ?? 'sandbox';

  const methods = useFeePaymentStore((s) => s.methods);
  const setMethodForNetwork = useFeePaymentStore((s) => s.setMethod);

  const method = methods[networkName] ?? DEFAULT_FEE_PAYMENT_METHOD;

  return {
    method,
    setMethod: (newMethod: FeePaymentMethodType) =>
      setMethodForNetwork(networkName, newMethod),
  };
};
