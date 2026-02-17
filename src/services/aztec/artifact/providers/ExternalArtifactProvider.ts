import {
  loadContractArtifact,
  type ContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import { ArtifactErrorFactory } from '../../../../utils/errors';
import {
  prepareArtifactForStorage,
  restoreBytecodeBuffers,
} from '../../../../utils/storage';
import { extractTgz } from '../../../../utils/tar';
import { getArtifactStorageService } from '../../../storage';
import type { IArtifactProvider, ArtifactProviderResult } from './types';
import type { SerializedArtifact } from '../../../../types/artifactRegistry';

// Bump version when the cached artifact format changes (e.g., raw → loadContractArtifact)
const CACHE_PREFIX = 'external';

function cacheKey(tgzUrl: string, contractName: string): string {
  return `${CACHE_PREFIX}:${tgzUrl}:${contractName}`;
}

/**
 * External artifact provider — fetches artifacts from a .tgz URL
 * (e.g., GitHub releases or npm tarballs).
 *
 * Flow:
 * 1. Check IndexedDB cache first (keyed by tgz URL + contract name)
 * 2. On miss: fetch tgz → decompress → parse tar → extract JSON artifacts
 * 3. Match contract names by artifact `.name` property or filename pattern
 * 4. Cache extracted artifacts in IndexedDB
 * 5. Return requested subset
 */
export class ExternalArtifactProvider implements IArtifactProvider {
  constructor(private tgzUrl: string) {}

  async loadArtifacts(
    contractNames: string[]
  ): Promise<ArtifactProviderResult> {
    const storage = getArtifactStorageService();

    // 1. Try loading each contract from cache
    const cached: Record<string, ContractArtifact> = {};
    const missing: string[] = [];

    await Promise.all(
      contractNames.map(async (name) => {
        const key = cacheKey(this.tgzUrl, name);
        const stored = await storage.get(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as SerializedArtifact;
            const restored = restoreBytecodeBuffers(parsed);
            // Validate the cached artifact has the processed format (not raw NoirCompiledContract)
            const hasParameters = restored.functions.every(
              (fn) => 'parameters' in fn
            );
            if (!hasParameters) {
              console.warn(
                `[ExternalArtifactProvider] Stale cache for "${name}", re-fetching`
              );
              missing.push(name);
              return;
            }
            cached[name] = restored;
            return;
          } catch {
            // Corrupted cache — will re-fetch
          }
        }
        missing.push(name);
      })
    );

    // All found in cache
    if (missing.length === 0) {
      return { artifacts: cached, sourceLabel: 'external:cached' };
    }

    // 2. Fetch and extract tgz
    const allArtifacts = await this.fetchAndExtract();

    // 3. Match requested contracts and cache
    const result: Record<string, ContractArtifact> = { ...cached };

    for (const name of missing) {
      const artifact = allArtifacts.get(name);
      if (artifact) {
        result[name] = artifact;
        // Cache for next time
        const serialized = JSON.stringify(prepareArtifactForStorage(artifact));
        const key = cacheKey(this.tgzUrl, name);
        storage.save(key, serialized).catch(() => {
          // Non-blocking cache save
        });
      }
    }

    return { artifacts: result, sourceLabel: 'external:fetched' };
  }

  /**
   * Fetch the tgz, extract, and parse all contract artifacts from it.
   * Returns a Map of lowercase contract name → ContractArtifact.
   */
  private async fetchAndExtract(): Promise<Map<string, ContractArtifact>> {
    let response: Response;
    try {
      response = await fetch(this.tgzUrl);
    } catch (err) {
      throw ArtifactErrorFactory.tgzFetchFailed(this.tgzUrl, err);
    }

    if (!response.ok) {
      throw ArtifactErrorFactory.fetchFailed(
        response.status,
        response.statusText
      );
    }

    const buffer = await response.arrayBuffer();

    let entries;
    try {
      entries = await extractTgz(buffer);
    } catch (err) {
      throw ArtifactErrorFactory.tgzExtractFailed(this.tgzUrl, err);
    }

    const artifacts = new Map<string, ContractArtifact>();
    const decoder = new TextDecoder();

    for (const entry of entries) {
      // Only process .json files in target/ directories
      if (!entry.name.endsWith('.json')) continue;

      try {
        const jsonStr = decoder.decode(entry.data);
        const parsed = JSON.parse(jsonStr);

        // Must look like a contract artifact (raw or processed)
        if (!parsed.name || !Array.isArray(parsed.functions)) continue;

        // Raw tgz artifacts are in NoirCompiledContract format (function.abi.parameters).
        // loadContractArtifact() transforms them to ContractArtifact (function.parameters).
        const artifact = loadContractArtifact(parsed as NoirCompiledContract);

        // Derive a lookup name from the artifact name (lowercase)
        const artifactName = artifact.name.toLowerCase();
        artifacts.set(artifactName, artifact);

        // Also try to derive from filename pattern: "ContractName-ClassName.json"
        const filename = entry.name.split('/').pop() ?? '';
        const baseName = filename.replace('.json', '');
        // Try the part before the dash (e.g., "dripper" from "dripper-Dripper.json")
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
          `[ExternalArtifactProvider] Skipping "${filename}":`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return artifacts;
  }
}
