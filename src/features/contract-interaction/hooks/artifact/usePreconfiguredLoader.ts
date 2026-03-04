import { useCallback } from 'react';
import { useFormActions } from '../../../../store/form';
import { ArtifactFetchError, ArtifactError } from '../../../../utils/errors';
import { PRECONFIGURED_CONTRACTS } from '../../config/presets';
import { useContractActions, useArtifactActions } from '../../store';
import { resolvePreconfiguredArtifact } from '../useInteractionContracts';
import type { PreconfiguredContract } from '../../../../types/preconfiguredContract';

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
      setArtifactState({ error: null, isLoading: true });
      resetFormValues();

      try {
        const artifactJson = await resolvePreconfiguredArtifact(contract);
        if (!artifactJson) {
          const error = new ArtifactFetchError(
            'Artifact not available for this contract'
          );
          setArtifactState({ error, isLoading: false });
          return;
        }
        setArtifactInput(artifactJson);
        setArtifactState({ isLoading: false });
      } catch (err) {
        const error =
          err instanceof ArtifactError
            ? err
            : new ArtifactFetchError(
                err instanceof Error
                  ? err.message
                  : 'Failed to load preconfigured artifact'
              );
        setArtifactState({ error, isLoading: false });
      }
    },
    [
      setInvokeTarget,
      setArtifactState,
      setArtifactInput,
      resetFormValues,
      onClearState,
    ]
  );

  return {
    handleSelectPreconfigured,
  };
};
