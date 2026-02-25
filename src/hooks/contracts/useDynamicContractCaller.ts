import { useCallback, useState } from 'react';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { useFeePayment } from '../../store/feePayment';
import { useReadContract } from './useReadContract';
import { useWriteContract } from './useWriteContract';

interface CallParams {
  address: string;
  functionName: string;
  args: unknown[];
}

interface CallResult {
  success: boolean;
  data?: unknown;
  txHash?: string;
  error?: string;
}

export const useDynamicContractCaller = (
  artifact?: ContractArtifact | null
) => {
  const { readContract } = useReadContract();
  const { writeContract } = useWriteContract();
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

      setIsSimulating(true);
      setError(null);

      try {
        const result = await readContract({
          artifact,
          address,
          functionName,
          args,
        });

        if (!result.success) {
          setError(result.error ?? 'Simulation failed');
          return { success: false, error: result.error };
        }

        return { success: true, data: result.data };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsSimulating(false);
      }
    },
    [artifact, readContract]
  );

  const execute = useCallback(
    async (params: CallParams): Promise<CallResult> => {
      const { address, functionName, args } = params;

      if (!artifact) {
        return { success: false, error: 'Artifact not loaded' };
      }

      setIsExecuting(true);
      setError(null);

      try {
        const result = await writeContract({
          artifact,
          address,
          functionName,
          args,
          feePaymentMethod,
        });

        if (!result.success) {
          setError(result.error ?? 'Transaction failed');
          return { success: false, error: result.error, txHash: result.txHash };
        }

        return {
          success: true,
          data: result.data,
          txHash: result.txHash,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsExecuting(false);
      }
    },
    [artifact, writeContract, feePaymentMethod]
  );

  return {
    simulate,
    execute,
    isSimulating,
    isExecuting,
    error,
  };
};
