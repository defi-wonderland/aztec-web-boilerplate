import { useCallback } from 'react';
import { useArtifactActions } from '../../../store';
import {
  loadAndPrepareArtifact,
  parseArtifactSource,
} from '../../../utils/contractInteraction';
import { ArtifactError, ArtifactErrorFactory } from '../../../utils/errors';
import type { ParsedArtifact } from '../../../types/artifact';

type ParseResult =
  | { success: true; parsed: ParsedArtifact }
  | { success: false; error: ArtifactError };

type LoadResult =
  | {
      success: true;
      parsed: ParsedArtifact;
      address?: string;
      contractLabel?: string;
    }
  | { success: false; error: ArtifactError };

/**
 * Hook for artifact parsing with state management.
 */
export const useArtifactStateManager = () => {
  const { setArtifactState } = useArtifactActions();

  const parseAndSetArtifact = useCallback(
    (artifactJson: string): ParseResult => {
      try {
        const parsed = parseArtifactSource(artifactJson);
        setArtifactState({ parsed, error: null });
        return { success: true, parsed };
      } catch (err) {
        const error =
          err instanceof ArtifactError
            ? err
            : ArtifactErrorFactory.invalidStructure(
                err instanceof Error ? err.message : 'Failed to parse artifact'
              );
        setArtifactState({ parsed: null, error });
        return { success: false, error };
      }
    },
    [setArtifactState]
  );

  const loadAndSetArtifact = useCallback(
    (artifactJson: string, currentAddress?: string): LoadResult => {
      const result = loadAndPrepareArtifact(artifactJson, currentAddress ?? '');

      if (!result.success) {
        setArtifactState({ parsed: null, error: result.error });
        return { success: false, error: result.error };
      }

      setArtifactState({ parsed: result.parsed, error: null });
      return {
        success: true,
        parsed: result.parsed,
        address: result.address,
        contractLabel: result.contractLabel,
      };
    },
    [setArtifactState]
  );

  return { parseAndSetArtifact, loadAndSetArtifact };
};
