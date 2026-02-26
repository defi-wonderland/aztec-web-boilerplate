import { useContext } from 'react';
import { UseAztecRuntimeContext } from './useAztecRuntimeContext';
import type { AztecExecutionClient } from '../runtime/types';

export const useInternalAztecClient = (): AztecExecutionClient | null => {
  return useContext(UseAztecRuntimeContext);
};
