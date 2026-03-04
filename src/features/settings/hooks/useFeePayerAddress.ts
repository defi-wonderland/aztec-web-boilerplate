/**
 * Hook for fetching the fee payer address for a given fee payment method.
 * Uses React Query for caching and automatic state management.
 */

import { useQuery } from '@tanstack/react-query';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { hasAppManagedPXE } from '@aztec-wallet';
import { createFeePaymentMethod } from '../services/feePayment';
import { queryKeys } from '../../../hooks/queries/queryKeys';
import type { DeployedContractConfig } from '../../../config/networks/types';
import type { FeePaymentMethodType } from '../config/feePayment';
import type { WalletConnector } from '../../../types/walletConnector';

interface UseFeePayerAddressOptions {
  /** The selected fee payment method */
  selectedMethod: FeePaymentMethodType;
  /** The wallet connector (narrowed internally to app-managed PXE connectors) */
  connector: WalletConnector | null;
  /** The fee payment contracts configuration */
  feePaymentConfig: Record<string, DeployedContractConfig> | undefined;
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
/**
 * Creates a stable hash from the fee payment config for use in query keys.
 * Uses sorted keys to ensure consistent serialization regardless of property order.
 */
const getConfigHash = (
  config: Record<string, DeployedContractConfig> | undefined
): string => {
  if (!config) return '';
  const sortedKeys = Object.keys(config).sort();
  const sortedConfig = sortedKeys.reduce(
    (acc, key) => {
      acc[key] = config[key as keyof Record<string, DeployedContractConfig>];
      return acc;
    },
    {} as Record<string, unknown>
  );
  return JSON.stringify(sortedConfig);
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
  const isMeteredConfigured =
    feePaymentConfig != null && feePaymentConfig.metered?.address != null;
  const needsMeteredConfig =
    selectedMethod === 'metered' || selectedMethod === 'meteredExact';
  const configHash = getConfigHash(feePaymentConfig);

  const appManagedConnector = hasAppManagedPXE(connector) ? connector : null;

  const query = useQuery({
    queryKey: queryKeys.feePayer.address(selectedMethod, configHash),
    queryFn: async (): Promise<AztecAddress> => {
      if (!appManagedConnector) {
        throw new Error('App-managed PXE connector not available');
      }

      const method = await createFeePaymentMethod(selectedMethod, {
        config: feePaymentConfig ?? {},
        getSponsoredFeePaymentMethod: () =>
          appManagedConnector.getSponsoredFeePaymentMethod(),
      });

      return method.getFeePayer();
    },
    enabled:
      enabled &&
      appManagedConnector !== null &&
      (!needsMeteredConfig || isMeteredConfigured),
    staleTime: 60_000, // Fee payer addresses rarely change
  });

  return {
    feePayerAddress: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};
