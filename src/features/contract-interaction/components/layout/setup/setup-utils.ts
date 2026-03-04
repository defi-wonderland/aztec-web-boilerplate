/**
 * Shared types and pure helpers for the contract setup flow.
 */

import { buildConstructorLabel } from '../../../../../utils/deployableContracts';
import { loadAndPrepareArtifact } from '../../../utils';
import type { ParsedFunction } from '../../../../../types/artifact';
import type {
  ContractConstructor,
  DeployableContract,
} from '../../../../../utils/deployableContracts';

export type ArtifactInputMethod = 'file' | 'paste' | null;

export type SetupTab = 'load' | 'deploy';

export type ContractSource = 'preconfigured' | 'custom';

export type CustomDeployableResult = {
  contract: DeployableContract | null;
  error: string | null;
};

export const buildCustomDeployableContract = (
  artifactInput: string
): CustomDeployableResult => {
  if (!artifactInput.trim()) {
    return { contract: null, error: null };
  }

  try {
    // Empty address: we're parsing for deployment, no existing contract to target
    const result = loadAndPrepareArtifact(artifactInput, '');
    if ('error' in result) {
      return {
        contract: null,
        error: result.error?.message ?? 'Invalid artifact',
      };
    }

    const parsedArtifact = result.parsed;

    const constructors: ContractConstructor[] = parsedArtifact.functions
      .filter((fn: ParsedFunction) => fn.attributes.includes('abi_initializer'))
      .map((fn: ParsedFunction) => ({
        ...fn,
        label: buildConstructorLabel(fn.name),
      }));

    if (constructors.length === 0) {
      return {
        contract: null,
        error: 'No constructors found in the provided artifact',
      };
    }

    const contractName =
      (parsedArtifact.compiled as { name?: string })?.name ?? 'Custom Contract';

    return {
      contract: {
        id: 'custom',
        label: contractName,
        artifactJson: artifactInput,
        constructors,
      },
      error: null,
    };
  } catch {
    return { contract: null, error: 'Failed to parse artifact JSON' };
  }
};
