/**
 * Hook for fetching the fee payer address for a given fee payment method.
 * Uses React Query for caching and automatic state management.
 */

import { useQuery } from '@tanstack/react-query';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { createFeePaymentMethod } from '../../services/aztec/feePayment';
import { queryKeys } from './queryKeys';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';
import type { FeePaymentContractsConfig } from '../../config/networks/types';
import type {
  EmbeddedWalletConnector,
  ExternalSignerWalletConnector,
} from '../../types/walletConnector';

interface UseFeePayerAddressOptions {
  /** The selected fee payment method */
  selectedMethod: FeePaymentMethodType;
  /** The wallet connector (must have app-managed PXE) */
  connector: EmbeddedWalletConnector | ExternalSignerWalletConnector | null;
  /** The fee payment contracts configuration */
  feePaymentConfig: FeePaymentContractsConfig | undefined;
  /** Whether the query should be enabled */
  enabled?: boolean;
}

interface UseFeePayerAddressReturn {
  feePayerAddress: AztecAddress | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Creates a stable hash from the fee payment config for use in query keys.
 */
const getConfigHash = (
  config: FeePaymentContractsConfig | undefined
): string => {
  if (!config) return '';
  return JSON.stringify({
    enabled: config.enabled,
    contracts: config.contracts,
  });
};

/**
 * Hook to fetch the fee payer address for the selected fee payment method.
 */
export const useFeePayerAddress = ({
  selectedMethod,
  connector,
  feePaymentConfig,
  enabled = true,
}: UseFeePayerAddressOptions): UseFeePayerAddressReturn => {
  const configHash = getConfigHash(feePaymentConfig);
  const isFpcEnabled = feePaymentConfig?.enabled !== false;

  const query = useQuery({
    queryKey: queryKeys.feePayer.address(selectedMethod, configHash),
    queryFn: async (): Promise<AztecAddress> => {
      if (!connector) {
        throw new Error('Connector not available');
      }

      const method = await createFeePaymentMethod(selectedMethod, {
        config: feePaymentConfig ?? { enabled: false, contracts: {} },
        getSponsoredFeePaymentMethod: () =>
          connector.getSponsoredFeePaymentMethod(),
      });

      if (!method) {
        throw new Error('FPC is disabled for this network');
      }

      return method.getFeePayer();
    },
    enabled: enabled && connector !== null && isFpcEnabled,
    staleTime: 60_000, // Fee payer addresses rarely change
  });

  return {
    feePayerAddress: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};
