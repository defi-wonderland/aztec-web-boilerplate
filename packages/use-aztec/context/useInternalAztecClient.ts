import { useContext } from 'react';
import { UseAztecRuntimeContext } from './useAztecRuntimeContext';
import type { AztecExecutionClient } from '../types/execution';

export const useInternalAztecClient = (): AztecExecutionClient | null => {
  return useContext(UseAztecRuntimeContext);
};
