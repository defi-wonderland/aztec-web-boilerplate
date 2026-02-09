import { useCallback, useMemo, useState } from 'react';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { ContractBase } from '@aztec/aztec.js/contracts';
import { useFeePayment } from '../../store/feePayment';
import { useReadContract } from './useReadContract';
import { useWriteContract } from './useWriteContract';
import type { ContractClassFor } from '../../types/contractTypes';

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

  // readContract/writeContract expect a ContractClassFor<T> (i.e. a generated
  // contract class like TokenContract with a real `at` factory). This hook only
  // has a raw artifact, so we build a shim that provides:
  //   - `artifact`: the real ABI, used at runtime by Contract.at(address, artifact, wallet)
  //   - `at`: a dummy — only exists to satisfy the type shape. The typed hooks
  //     never call it; they use the generic Contract.at() SDK factory instead.
  const contractShim: ContractClassFor<ContractBase> | null = useMemo(() => {
    if (!artifact) return null;
    return {
      artifact,
      at: () => ({}),
    } as unknown as ContractClassFor<ContractBase>;
  }, [artifact]);

  const simulate = useCallback(
    async (params: CallParams): Promise<CallResult> => {
      const { address, functionName, args } = params;

      if (!contractShim) {
        return { success: false, error: 'Artifact not loaded' };
      }

      setIsSimulating(true);
      setError(null);

      try {
        const result = await readContract({
          contract: contractShim,
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
    [contractShim, readContract]
  );

  const execute = useCallback(
    async (params: CallParams): Promise<CallResult> => {
      const { address, functionName, args } = params;

      if (!contractShim) {
        return { success: false, error: 'Artifact not loaded' };
      }

      setIsExecuting(true);
      setError(null);

      try {
        const result = await writeContract({
          contract: contractShim,
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
    [contractShim, writeContract, feePaymentMethod]
  );

  return {
    simulate,
    execute,
    isSimulating,
    isExecuting,
    error,
  };
};
