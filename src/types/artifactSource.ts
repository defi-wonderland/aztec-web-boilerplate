import type { ContractArtifact } from '@aztec/aztec.js/abi';

/**
 * Describes how to fetch artifacts from a specific source.
 *
 * - `registry` — Fetch from an artifact registry by classId (verified).
 * - `local` — Use a bundled artifact directly (no network request).
 */
export type ArtifactSourceConfig =
  | { registry: string }
  | { local: ContractArtifact };

/** Normalized form used internally by ArtifactService */
export type NormalizedArtifactSource =
  | { type: 'registry'; url: string }
  | { type: 'local'; artifact: ContractArtifact };

/** Normalize shorthand config into a uniform shape for internal use */
export function normalizeArtifactSource(
  source: ArtifactSourceConfig
): NormalizedArtifactSource {
  if ('registry' in source) return { type: 'registry', url: source.registry };
  return { type: 'local', artifact: source.local };
}
