import { useCallback } from 'react';
import {
  PRECONFIGURED_CONTRACTS,
  type PreconfiguredContract,
} from '../../config/preconfiguredContracts';
import {
  useContractActions,
  useArtifactActions,
  useFormActions,
} from '../../store';
import { ArtifactFetchError } from '../../utils/errors';
import { resolvePreconfiguredArtifact } from '../useInteractionContracts';
import { useArtifactStateManager } from './useArtifactStateManager';

export interface UsePreconfiguredLoaderOptions {
  onClearState: () => void;
}

export interface UsePreconfiguredLoaderReturn {
  handleSelectPreconfigured: (contractId: string | null) => Promise<void>;
}

/**
 * Hook for loading preconfigured contracts.
 * Handles selection and artifact fetching for contracts defined in PRECONFIGURED_CONTRACTS.
 */
export const usePreconfiguredLoader = (
  options: UsePreconfiguredLoaderOptions
): UsePreconfiguredLoaderReturn => {
  const { onClearState } = options;

  const { setInvokeTarget } = useContractActions();
  const { setArtifactInput, setArtifactState } = useArtifactActions();
  const { reset: resetFormValues } = useFormActions();
  const { setLoading, handleArtifactError } = useArtifactStateManager();

  const handleSelectPreconfigured = useCallback(
    async (contractId: string | null) => {
      if (!contractId) {
        setInvokeTarget('', null);
        onClearState();
        return;
      }

      const contract = PRECONFIGURED_CONTRACTS.find(
        (c): c is PreconfiguredContract => c.id === contractId
      );
      if (!contract) return;

      setInvokeTarget(contract.address, contractId);
      setArtifactState({ error: null });
      setLoading(true);
      resetFormValues();

      try {
        const artifactJson = await resolvePreconfiguredArtifact(contract);
        if (!artifactJson) {
          handleArtifactError(
            new ArtifactFetchError('Artifact not available for this contract'),
            'Load failed'
          );
          return;
        }
        setArtifactInput(artifactJson);
        setLoading(false);
      } catch (err) {
        handleArtifactError(err, 'Failed to load preconfigured artifact');
      }
    },
    [
      setInvokeTarget,
      setArtifactState,
      setArtifactInput,
      resetFormValues,
      onClearState,
      setLoading,
      handleArtifactError,
    ]
  );

  return {
    handleSelectPreconfigured,
  };
};
