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
      setArtifactState({ isLoading: true, error: null });
      resetFormValues();

      try {
        const artifactJson = await resolvePreconfiguredArtifact(contract);
        if (!artifactJson) {
          setArtifactState({
            error: new ArtifactFetchError(
              'Artifact not available for this contract'
            ),
            isLoading: false,
          });
          return;
        }
        setArtifactInput(artifactJson);
        setArtifactState({ isLoading: false });
      } catch (err) {
        const error =
          err instanceof ArtifactFetchError
            ? err
            : new ArtifactFetchError(
                err instanceof Error ? err.message : 'Failed to load artifact',
                undefined,
                undefined,
                err
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
