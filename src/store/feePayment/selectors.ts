/**
 * Fee Payment Store Selectors
 *
 * Hook selectors for accessing fee payment state per network.
 */

import { useAztecWallet } from '../../aztec-wallet';
import { useFeePaymentStore, DEFAULT_FEE_PAYMENT_METHOD } from './store';
import type { FeePaymentMethodType } from '../../services/aztec/feePayment/feePaymentMethods';

/**
 * Returns the fee payment method for the connected network.
 */
export const useFeePayment = () => {
  const { networkName: connectedNetwork } = useAztecWallet();
  const networkName = connectedNetwork ?? 'sandbox';

  const methods = useFeePaymentStore((s) => s.methods);
  const setMethodForNetwork = useFeePaymentStore((s) => s.setMethod);

  const method = methods[networkName] ?? DEFAULT_FEE_PAYMENT_METHOD;

  return {
    method,
    setMethod: (newMethod: FeePaymentMethodType) =>
      setMethodForNetwork(networkName, newMethod),
  };
};
