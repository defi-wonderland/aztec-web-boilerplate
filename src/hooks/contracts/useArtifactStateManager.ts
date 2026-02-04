import { useCallback } from 'react';
import { useContractActions, useArtifactActions } from '../../store';
import { parseArtifactSource } from '../../utils/contractInteraction';
import {
  ArtifactError,
  ArtifactParseError,
  ArtifactFetchError,
  getErrorMessage,
} from '../../utils/errors';
import type { ParsedArtifact } from '../../types/artifact';

interface ArtifactLoadSuccess {
  success: true;
  parsed: ParsedArtifact;
}

interface ArtifactLoadFailure {
  success: false;
  error: ArtifactError;
}

type ArtifactLoadResult = ArtifactLoadSuccess | ArtifactLoadFailure;

export interface UseArtifactStateManagerReturn {
  /** Reset artifact state before loading */
  resetArtifactState: () => void;

  /** Parse artifact JSON and update store state */
  parseAndSetArtifact: (artifactJson: string) => ArtifactLoadResult;

  /** Handle artifact error with appropriate logging */
  handleArtifactError: (err: unknown, title: string) => ArtifactError;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
}

/**
 * Hook for managing artifact loading state operations.
 * Consolidates shared patterns across useSavedContractManager,
 * usePreconfiguredLoader, and useLoadArtifact.
 */
export const useArtifactStateManager = (): UseArtifactStateManagerReturn => {
  const { pushLog } = useContractActions();
  const { setArtifactState } = useArtifactActions();

  const resetArtifactState = useCallback(() => {
    setArtifactState({ error: null, parsed: null });
  }, [setArtifactState]);

  const setLoading = useCallback(
    (isLoading: boolean) => {
      setArtifactState({ isLoading });
    },
    [setArtifactState]
  );

  const parseAndSetArtifact = useCallback(
    (artifactJson: string): ArtifactLoadResult => {
      try {
        const parsed = parseArtifactSource(artifactJson);
        setArtifactState({ parsed, error: null });
        return { success: true, parsed };
      } catch (err) {
        const error =
          err instanceof ArtifactError
            ? err
            : ArtifactParseError.invalidStructure(
                err instanceof Error ? err.message : 'Failed to parse artifact'
              );
        setArtifactState({ parsed: null, error });
        return { success: false, error };
      }
    },
    [setArtifactState]
  );

  const handleArtifactError = useCallback(
    (err: unknown, title: string): ArtifactError => {
      const error =
        err instanceof ArtifactError
          ? err
          : new ArtifactFetchError(
              err instanceof Error ? err.message : 'Failed to load artifact'
            );

      setArtifactState({ error, isLoading: false });
      pushLog({
        level: 'error',
        title,
        detail: getErrorMessage(error),
      });

      return error;
    },
    [setArtifactState, pushLog]
  );

  return {
    resetArtifactState,
    parseAndSetArtifact,
    handleArtifactError,
    setLoading,
  };
};
