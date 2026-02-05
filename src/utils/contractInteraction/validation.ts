import { AztecAddress } from '@aztec/aztec.js/addresses';
import { ArtifactError, ArtifactErrorFactory } from '../errors';
import { buildArgsFromInputs } from './parameterBuilder';
import { parseArtifactSource } from './parser';
import type { ParsedFunction, ParsedArtifact } from '../../types/artifact';

export const isValidAztecAddress = (value: string): boolean => {
  if (!value) return false;
  try {
    AztecAddress.fromString(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * @internal Result type for call validation.
 */
type CallValidationResult =
  | {
      valid: true;
      args: unknown[];
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Validates call prerequisites and builds arguments for contract execution.
 */
export const validateAndBuildCallArgs = (
  address: string,
  selectedFn: ParsedFunction | null,
  formValues: Record<string, string>
): CallValidationResult => {
  if (!selectedFn) {
    return { valid: false, error: 'No function selected' };
  }

  if (!isValidAztecAddress(address)) {
    return { valid: false, error: 'Provide a valid Aztec address.' };
  }

  const { args, errors } = buildArgsFromInputs(selectedFn.inputs, formValues);
  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true, args };
};

/**
 * @internal Result type for artifact loading.
 */
type LoadArtifactResult =
  | {
      success: true;
      parsed: ParsedArtifact;
      address: string;
      contractLabel: string | undefined;
    }
  | {
      success: false;
      error: ArtifactError;
    };

/**
 * Parses artifact source and prepares data for caching and state updates.
 * Pure function that extracts business logic from component.
 */
export const loadAndPrepareArtifact = (
  artifactInput: string,
  currentAddress: string
): LoadArtifactResult => {
  try {
    const parsed = parseArtifactSource(artifactInput);
    const discoveredAddress = (parsed.compiled as { address?: string }).address;
    const contractLabel = (parsed.compiled as { name?: string }).name;

    // Always prefer the user-supplied address (e.g., freshly deployed) over any
    // embedded address in the artifact to avoid pointing at a stale/prebuilt
    // instance.
    const address =
      (currentAddress &&
        isValidAztecAddress(currentAddress) &&
        currentAddress) ||
      (discoveredAddress && isValidAztecAddress(discoveredAddress)
        ? discoveredAddress
        : '');

    return {
      success: true,
      parsed,
      address,
      contractLabel,
    };
  } catch (err) {
    const error =
      err instanceof ArtifactError
        ? err
        : ArtifactErrorFactory.invalidStructure(
            err instanceof Error ? err.message : 'Failed to parse artifact'
          );
    return { success: false, error };
  }
};
