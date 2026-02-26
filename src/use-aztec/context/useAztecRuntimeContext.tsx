import { createContext } from 'react';
import type { AztecExecutionClient } from '../runtime/types';

export const UseAztecRuntimeContext =
  createContext<AztecExecutionClient | null>(null);
