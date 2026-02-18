import { useCallback } from 'react';
import { readFieldCompressedString } from '@aztec/aztec.js/utils';
import {
  useContractTargetAddress,
  useContractActions,
  useFormValues,
  useParsedArtifact,
} from '../../store';
import {
  formatResultData,
  validateAndBuildCallArgs,
} from '../../utils/contractInteraction';
import { safeStringify } from '../../utils/string';
import { useDynamicContractCaller } from './useDynamicContractCaller';
import type { FunctionGroup } from '../../components/contract-interaction/types';

export interface UseContractCallerOptions {
  grouped: FunctionGroup[];
}

export interface UseContractCallerReturn {
  handleSimulate: (functionName: string) => Promise<void>;
  handleExecute: (functionName: string) => Promise<void>;
  isSimulating: boolean;
  isExecuting: boolean;
  error: string | null;
}

/**
 * Hook for invoking contract functions (simulate/execute).
 * Handles validation, argument building, and result formatting.
 */
export const useContractCaller = (
  options: UseContractCallerOptions
): UseContractCallerReturn => {
  const { grouped } = options;

  const address = useContractTargetAddress();
  const formValues = useFormValues();
  const parsed = useParsedArtifact();
  const { pushLog } = useContractActions();

  const {
    simulate,
    execute,
    isExecuting,
    isSimulating,
    error: callerError,
  } = useDynamicContractCaller(parsed?.artifact);

  const callFunction = useCallback(
    async (mode: 'simulate' | 'execute', functionName: string) => {
      if (!parsed) {
        pushLog({
          level: 'error',
          title: 'Missing artifact',
          detail: 'Load an artifact first',
        });
        return;
      }

      const selectedFn = grouped
        .flatMap((g) => g.items)
        .find((fn) => fn.name === functionName);
      if (!selectedFn) {
        pushLog({
          level: 'error',
          title: 'Function not found',
          detail: `No function named "${functionName}" in artifact`,
        });
        return;
      }

      const validation = validateAndBuildCallArgs(
        address,
        selectedFn,
        formValues
      );
      if (!validation.valid) {
        pushLog({
          level: 'error',
          title: 'Validation failed',
          detail: validation.error ?? 'Invalid args',
        });
        return;
      }

      const isSimulate = mode === 'simulate';
      const actionLabel = isSimulate ? 'Simulating' : 'Executing';
      pushLog({
        level: 'info',
        title: `${actionLabel} ${selectedFn.name}`,
        detail: `Args: ${safeStringify(validation.args)}`,
      });

      const caller = isSimulate ? simulate : execute;
      const result = await caller({
        address,
        functionName: selectedFn.name,
        args: validation.args,
      });

      if (!result.success) {
        pushLog({
          level: 'error',
          title: `${isSimulate ? 'Simulation' : 'Execution'} failed`,
          detail: result.error ?? 'Unknown error',
        });
        return;
      }

      pushLog({
        level: 'success',
        title: `${isSimulate ? 'Simulation' : 'Execution'} complete`,
        detail: safeStringify(
          formatResultData(
            result.data ?? result.txHash,
            readFieldCompressedString
          )
        ),
      });
    },
    [parsed, address, formValues, grouped, simulate, execute, pushLog]
  );

  const handleSimulate = useCallback(
    (functionName: string) => callFunction('simulate', functionName),
    [callFunction]
  );

  const handleExecute = useCallback(
    (functionName: string) => callFunction('execute', functionName),
    [callFunction]
  );

  return {
    handleSimulate,
    handleExecute,
    isSimulating,
    isExecuting,
    error: callerError,
  };
};
