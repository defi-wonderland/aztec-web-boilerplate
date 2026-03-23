import { useCallback, useState } from 'react';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { useFeePayment } from '../../../store/feePayment';
import { useAztecClient } from '../../../use-aztec';

interface CallParams {
  address: string;
  functionName: string;
  args: unknown[]; // Untyped — the artifact's ABI handles encoding/decoding at runtime
}

interface CallResult {
  success: boolean;
  data?: unknown;
  txHash?: string;
  error?: string;
}

/**
 * Hook for dynamically calling arbitrary contract functions.
 * Delegates to use-aztec core execution functions via the adapter pattern,
 * keeping wallet-specific branching centralized in the integration layer.
 */
export const useDynamicContractCaller = (
  artifact?: ContractArtifact | null
) => {
  const client = useAztecClient();
  const { method: feePaymentMethod } = useFeePayment();
  const [isSimulating, setIsSimulating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = useCallback(
    async (params: CallParams): Promise<CallResult> => {
      const { address, functionName, args } = params;

      if (!artifact) {
        return { success: false, error: 'Artifact not loaded' };
      }

      if (!client) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsSimulating(true);
      setError(null);

      try {
        const result = await client.executeRead({
          artifact,
          address,
          functionName,
          args,
        });

        return { success: true, data: result };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsSimulating(false);
      }
    },
    [artifact, client]
  );

  const execute = useCallback(
    async (params: CallParams): Promise<CallResult> => {
      const { address, functionName, args } = params;

      if (!artifact) {
        return { success: false, error: 'Artifact not loaded' };
      }

      if (!client) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsExecuting(true);
      setError(null);

      try {
        const result = await client.executeWrite({
          artifact,
          address,
          functionName,
          args,
          feePaymentMethod,
        });

        return {
          success: true,
          txHash: result.txHash,
          data: result.result,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsExecuting(false);
      }
    },
    [artifact, client, feePaymentMethod]
  );

  return {
    simulate,
    execute,
    isSimulating,
    isExecuting,
    error,
  };
};
