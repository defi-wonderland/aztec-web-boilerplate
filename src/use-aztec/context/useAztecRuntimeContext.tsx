import { createContext } from 'react';
import type { AztecExecutionClient } from '../types/execution';

export interface UseAztecRuntimeContextValue {
  client: AztecExecutionClient | null;
  networkId: string | undefined;
}

export const UseAztecRuntimeContext =
  createContext<UseAztecRuntimeContextValue>({
    client: null,
    networkId: undefined,
  });
