import {
  loadContractArtifact,
  type ContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import { ArtifactErrorFactory } from '../../../utils/errors';
import {
  prepareArtifactForStorage,
  restoreBytecodeBuffers,
} from '../../../utils/storage';
import { extractTgz, type TarEntry } from '../../../utils/tar';
import { getArtifactStorageService } from '../../storage';
import type { SerializedArtifact } from '../../../types/artifactRegistry';

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `external:${CACHE_VERSION}`;

/** Timeout for fetching a tgz package (30 seconds) */
const TGZ_FETCH_TIMEOUT_MS = 30_000;

/** In-flight tgz fetch+extract dedup map (keyed by tgz URL) */
const inflightExtractions = new Map<
  string,
  Promise<Map<string, ContractArtifact>>
>();

function cacheKey(tgzUrl: string, contractName: string): string {
  return `${CACHE_PREFIX}:${tgzUrl}:${contractName}`;
}

interface ExternalArtifactResult {
  artifact: ContractArtifact;
  sourceLabel: string;
}

/**
 * Load a single contract artifact from a tgz URL.
 * - Checks IndexedDB cache first
 * - On miss: fetches tgz (deduped across concurrent calls), extracts all
 *   artifacts, eagerly caches all, returns the requested one
 */
export async function loadExternalArtifact(
  tgzUrl: string,
  contractName: string
): Promise<ExternalArtifactResult> {
  // 1. Check cache
  const storage = getArtifactStorageService();
  const stored = await storage.get(cacheKey(tgzUrl, contractName));
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as SerializedArtifact;
      const restored = restoreBytecodeBuffers(parsed);
      const hasParameters = restored.functions.every(
        (fn) => 'parameters' in fn
      );
      if (hasParameters) {
        return { artifact: restored, sourceLabel: 'external' };
      }
      console.warn(
        `[externalTgz] Stale cache for "${contractName}", re-fetching`
      );
    } catch {
      // Corrupted cache — will re-fetch
    }
  }

  // 2. Fetch with dedup
  let allArtifacts: Map<string, ContractArtifact>;
  const inflight = inflightExtractions.get(tgzUrl);
  if (inflight) {
    allArtifacts = await inflight;
  } else {
    const promise = fetchAndExtractTgz(tgzUrl);
    inflightExtractions.set(tgzUrl, promise);
    try {
      allArtifacts = await promise;
    } finally {
      inflightExtractions.delete(tgzUrl);
    }
  }

  // 3. Eagerly cache ALL extracted artifacts
  for (const [name, art] of allArtifacts) {
    const serialized = JSON.stringify(prepareArtifactForStorage(art));
    storage.save(cacheKey(tgzUrl, name), serialized).catch(() => {});
  }

  // 4. Return requested
  const artifact = allArtifacts.get(contractName);
  if (!artifact) {
    throw ArtifactErrorFactory.contractNotInPackage(contractName, tgzUrl);
  }
  return { artifact, sourceLabel: 'external' };
}

/**
 * Fetch a tgz, extract, and parse all contract artifacts from it.
 * Returns a Map of lowercase contract name → ContractArtifact.
 */
async function fetchAndExtractTgz(
  tgzUrl: string
): Promise<Map<string, ContractArtifact>> {
  let response: Response;
  try {
    response = await fetch(tgzUrl, {
      signal: AbortSignal.timeout(TGZ_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw ArtifactErrorFactory.tgzFetchFailed(tgzUrl, err);
  }

  if (!response.ok) {
    throw ArtifactErrorFactory.fetchFailed(
      response.status,
      response.statusText
    );
  }

  const buffer = await response.arrayBuffer();

  let entries: TarEntry[];
  try {
    entries = await extractTgz(buffer);
  } catch (err) {
    throw ArtifactErrorFactory.tgzExtractFailed(tgzUrl, err);
  }

  const artifacts = new Map<string, ContractArtifact>();
  const decoder = new TextDecoder();

  for (const entry of entries) {
    if (!entry.name.endsWith('.json')) continue;

    try {
      const jsonStr = decoder.decode(entry.data);
      const parsed = JSON.parse(jsonStr);

      if (!parsed.name || !Array.isArray(parsed.functions)) continue;

      const artifact = loadContractArtifact(parsed as NoirCompiledContract);

      const artifactName = artifact.name.toLowerCase();
      artifacts.set(artifactName, artifact);

      // Also index by filename prefix: "dripper-Dripper.json" → "dripper"
      const filename = entry.name.split('/').pop() ?? '';
      const baseName = filename.replace('.json', '');
      const dashIdx = baseName.indexOf('-');
      if (dashIdx > 0) {
        const prefix = baseName.substring(0, dashIdx).toLowerCase();
        if (!artifacts.has(prefix)) {
          artifacts.set(prefix, artifact);
        }
      }
    } catch (err) {
      const filename = entry.name.split('/').pop() ?? entry.name;
      console.warn(
        `[externalTgz] Skipping "${filename}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return artifacts;
}
