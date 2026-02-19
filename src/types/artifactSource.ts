import type { ContractArtifact } from '@aztec/aztec.js/abi';

/**
 * Describes how to fetch artifacts from a specific source.
 *
 * - `registry` — Fetch from an artifact registry by classId (verified).
 * - `external` — Fetch a tgz package from a URL and match artifacts by name.
 *   **Warning:** The tgz contents are trusted based on contract name match alone.
 *   Unless a `classId` is configured for the contract, there is no integrity
 *   verification. Only use URLs you trust (e.g. pinned GitHub release tags).
 * - `local` — Use a bundled artifact directly (no network request).
 */
export type ArtifactSourceConfig =
  | { registry: string }
  | { external: string }
  | { local: ContractArtifact };

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
