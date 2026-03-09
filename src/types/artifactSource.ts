import type {
  ContractArtifact,
  NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import { loadContractArtifact } from '@aztec/aztec.js/abi';

/**
 * Describes how to fetch artifacts from a specific source.
 *
 * - `registry` — Fetch from an artifact registry by classId (verified).
 * - `local` — Use a bundled artifact directly (no network request).
 *   Accepts either a processed ContractArtifact or raw Noir compiler output JSON.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonImport = Record<string, any>;

export type ArtifactSourceConfig =
  | { registry: string }
  | { local: ContractArtifact | JsonImport };

/** Normalized form used internally by ArtifactService */
export type NormalizedArtifactSource =
  | { type: 'registry'; url: string }
  | { type: 'local'; artifact: ContractArtifact };

/** Normalize shorthand config into a uniform shape for internal use */
export function normalizeArtifactSource(
  source: ArtifactSourceConfig
): NormalizedArtifactSource {
  if ('registry' in source) return { type: 'registry', url: source.registry };
  return {
    type: 'local',
    artifact: loadContractArtifact(source.local as NoirCompiledContract),
  };
}
