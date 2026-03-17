import { useCallback } from 'react';
import { readFieldCompressedString } from '@aztec/aztec.js/utils';
import {
  useContractActions,
  useFormValues,
  useInvokeFlowData,
} from '../../../store';
import {
  formatResultData,
  validateAndBuildCallArgs,
} from '../../../utils/contractInteraction';
import { safeStringify } from '../../../utils/string';
import { useDynamicContractCaller } from './useDynamicContractCaller';
import type {
  CallMode,
  FunctionGroup,
} from '../../../components/contract-interaction/types';

export interface UseContractCallerOptions {
  grouped: FunctionGroup[];
}

export interface UseContractCallerReturn {
  handleSimulate: (functionName: string) => Promise<string | null>;
  handleExecute: (functionName: string) => Promise<string | null>;
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

  const { address, parsedArtifact: parsed } = useInvokeFlowData();
  const formValues = useFormValues();
  const { pushLog } = useContractActions();

  const {
    simulate,
    execute,
    isExecuting,
    isSimulating,
    error: callerError,
  } = useDynamicContractCaller(parsed?.artifact ?? null);

  const callFunction = useCallback(
    async (mode: CallMode, functionName: string): Promise<string | null> => {
      if (!parsed) {
        pushLog({
          level: 'error',
          title: 'Missing artifact',
          detail: 'Load an artifact first',
        });
        return null;
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
        return null;
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
        return null;
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
        return null;
      }

      const formattedResult = safeStringify(
        formatResultData(
          result.data ?? result.txHash,
          readFieldCompressedString
        )
      );

      pushLog({
        level: 'success',
        title: `${isSimulate ? 'Simulation' : 'Execution'} complete`,
        detail: formattedResult,
      });

      return formattedResult;
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
