import { useContext } from 'react';
import { UseAztecContext } from './useAztecContext';
import type { UseAztecConfig } from '../config/types';

/**
 * Returns the current UseAztecConfig from context.
 * Must be used within a UseAztecProvider.
 */
export const useAztec = (): UseAztecConfig => {
  const config = useContext(UseAztecContext);
  if (!config) {
    throw new Error('useAztec must be used within a UseAztecProvider');
  }
  return config;
};
