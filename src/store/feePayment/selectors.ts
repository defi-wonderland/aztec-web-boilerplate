/**
 * Fee Payment Store Selectors
 *
 * Hook selectors for accessing fee payment state per network.
 */

import { useAztecWallet } from '../../aztec-wallet';
import { getAvailableFeePaymentMethods } from '../../services/aztec/feePayment/feePaymentMethods';
import { getNetworkDeployments } from '../../utils/deployments';
import { useFeePaymentStore, DEFAULT_FEE_PAYMENT_METHOD } from './store';
import type { FeePaymentMethodType } from '../../services/aztec/feePayment/feePaymentMethods';

/**
 * Returns the normalized fee payment method for the connected network.
 *
 * If the persisted method is not available on the current network
 * (e.g. metered FPC doesn't exist), falls back to the first available method
 * and syncs the corrected value back to the store.
 */
export const useFeePayment = () => {
  const { networkName: connectedNetwork } = useAztecWallet();
  const networkName = connectedNetwork ?? 'sandbox';

  const methods = useFeePaymentStore((s) => s.methods);
  const setMethodForNetwork = useFeePaymentStore((s) => s.setMethod);

  const persisted = methods[networkName] ?? DEFAULT_FEE_PAYMENT_METHOD;

  const deployments = getNetworkDeployments(networkName);
  const availableMethods = getAvailableFeePaymentMethods(deployments);

  const method = availableMethods.includes(persisted)
    ? persisted
    : availableMethods[0];

  // Sync corrected value back to store so other consumers read the valid method
  if (method !== persisted) {
    // Use queueMicrotask to avoid setting state during render
    queueMicrotask(() => setMethodForNetwork(networkName, method));
  }

  return {
    method,
    setMethod: (newMethod: FeePaymentMethodType) =>
      setMethodForNetwork(networkName, newMethod),
  };
};
