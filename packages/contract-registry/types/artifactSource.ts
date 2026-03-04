import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { ArtifactSourceConfig } from '../core/types';

export type { ArtifactSourceConfig } from '../core/types';

/** Normalized form used internally by ArtifactService */
export type NormalizedArtifactSource =
  | { type: 'registry'; url: string }
  | { type: 'external'; url: string }
  | { type: 'local'; artifact: ContractArtifact };

/** Normalize shorthand config into a uniform shape for internal use */
export function normalizeArtifactSource(
  source: ArtifactSourceConfig
): NormalizedArtifactSource {
  if ('registry' in source) return { type: 'registry', url: source.registry };
  if ('external' in source) return { type: 'external', url: source.external };
  return { type: 'local', artifact: source.local };
}
