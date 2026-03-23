import { createContext } from 'react';
import type { AztecExecutionClient } from '../types/execution';

export const UseAztecRuntimeContext =
  createContext<AztecExecutionClient | null>(null);
