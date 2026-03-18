import type { ContractArtifact } from '@aztec/aztec.js/abi';
import {
  normalizeArtifactSource,
  type ArtifactSourceConfig,
  type NormalizedArtifactSource,
} from '../../../types/artifactSource';
import {
  prepareArtifactForStorage,
  restoreBytecodeBuffers,
} from '../../../utils/storage';
import { getArtifactStorageService } from '../../storage/ArtifactStorageService';
import { ArtifactRegistryService } from '../artifactRegistry';
import type { ContractConfigMap } from '../../../contract-registry/types';
import type { SerializedArtifact } from '../../../types/artifactRegistry';
import type { NetworkConfig } from '../../../types/network';

const CACHE_PREFIX = 'cached:v1';

/** Resolved artifacts keyed by contract name */
export type ResolvedArtifacts = Record<string, ContractArtifact>;

export interface LoadArtifactsResult {
  artifacts: ResolvedArtifacts;
  elapsedMs: number;
  sourceLabel: string;
}

interface ContractLoadResult {
  artifact: ContractArtifact;
  sourceLabel: string;
}

/**
 * Service for loading contract artifacts based on per-contract configuration.
 *
 * Each contract defines its own ordered fallback chain of sources via
 * `contractConfig.artifactSources(networkConfig)`. Sources are tried in order,
 * first success wins. Every contract must have at least one source that
 * resolves (typically a `{ local: artifact }` as the final fallback).
 */
export class ArtifactService {
  private static instance: ArtifactService | null = null;
  private memoryCache = new Map<string, ContractArtifact>();

  private constructor() {}

  static getInstance(): ArtifactService {
    if (!this.instance) {
      this.instance = new ArtifactService();
    }
    return this.instance;
  }

  /**
   * Load artifacts for all contracts in the config map using per-contract sources.
   * Each contract's fallback chain is tried independently in parallel.
   *
   * @returns All resolved artifacts (every contract gets an artifact)
   */
  async loadArtifacts(
    config: NetworkConfig,
    contracts: ContractConfigMap
  ): Promise<LoadArtifactsResult> {
    const start = performance.now();

    const contractNames = Object.keys(contracts);

    // Load each contract with its own fallback chain, in parallel
    // (registry sources without a classId are silently skipped)
    const results = await Promise.all(
      contractNames.map((name) => {
        const contractDef = contracts[name];
        const sources = contractDef.artifactSources;
        const classId = contractDef.classId;
        return this.loadWithFallback(name, sources, classId);
      })
    );

    const artifacts: ResolvedArtifacts = {};
    let sourceLabel = 'local';

    contractNames.forEach((name, i) => {
      const result = results[i];
      artifacts[name] = result.artifact;
      if (sourceLabel === 'local' && result.sourceLabel !== 'local') {
        sourceLabel = result.sourceLabel;
      }
    });

    return {
      artifacts,
      elapsedMs: performance.now() - start,
      sourceLabel,
    };
  }

  /**
   * Load a single artifact using an ordered fallback chain of sources.
   * Reuses the same cache-check + fallback + persist behavior used by
   * boilerplate contracts, making it available to preconfigured/deployable
   * contract configs that define their own `artifactSources`.
   */
  async loadArtifact(
    contractName: string,
    sources: ArtifactSourceConfig[],
    classId?: string
  ): Promise<ContractLoadResult> {
    return this.loadWithFallback(contractName, sources, classId);
  }

  /**
   * Try each source in the fallback chain for a single contract.
   * Returns on first success. All sources exhausted without success is an error.
   */
  private async loadWithFallback(
    contractName: string,
    sources: ArtifactSourceConfig[],
    classId?: string
  ): Promise<ContractLoadResult> {
    if (sources.length === 0) {
      throw new Error(
        `Contract "${contractName}" has no artifact sources configured`
      );
    }

    // Unified cache check — content-addressed by classId, skipped for local-only
    if (classId) {
      const cached = await this.checkCache(classId);
      if (cached) {
        console.log(`[ArtifactService] "${contractName}" — unified cache hit`);
        return { artifact: cached, sourceLabel: 'cached' };
      }
    }

    const normalized = sources.map(normalizeArtifactSource);
    const total = normalized.length;

    for (let i = 0; i < total; i++) {
      const source = normalized[i];
      const step = i + 1;
      const label = this.sourceLabel(source);

      // Local source — return the bundled artifact directly
      if (source.type === 'local') {
        console.log(
          `[ArtifactService] ${step}/${total} "${contractName}" — using bundled artifact`
        );
        return { artifact: source.artifact, sourceLabel: 'local' };
      }

      console.log(
        `[ArtifactService] ${step}/${total} "${contractName}" — fetching from ${label}...`
      );

      try {
        const result = await this.loadFromSource(contractName, source, classId);
        console.log(
          `[ArtifactService] "${contractName}" — loaded from ${label}`
        );

        // Persist to unified cache for instant loads on refresh
        if (classId) {
          this.saveToCache(classId, result.artifact);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const nextSource =
          i + 1 < total ? this.sourceLabel(normalized[i + 1]) : null;
        if (nextSource) {
          console.warn(
            `[ArtifactService] "${contractName}" — ${label} failed, falling back to ${nextSource}. Reason: ${error.message}`
          );
        } else {
          console.error(
            `[ArtifactService] "${contractName}" — ${label} failed, no more sources. Reason: ${error.message}`
          );
        }
      }
    }

    throw new Error(
      `All artifact sources failed for contract "${contractName}"`
    );
  }

  private sourceLabel(source: NormalizedArtifactSource): string {
    switch (source.type) {
      case 'registry':
        return `registry (${source.url})`;
      case 'local':
        return 'bundled artifact';
    }
  }

  /** Check unified cache: memory first, then IndexedDB. */
  private async checkCache(classId: string): Promise<ContractArtifact | null> {
    const key = `${CACHE_PREFIX}:${classId}`;

    // Memory cache (same session)
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached) return memoryCached;

    // IndexedDB cache (across sessions)
    try {
      const stored = await getArtifactStorageService().get(key);
      if (!stored) return null;

      const parsed = JSON.parse(stored) as SerializedArtifact;

      // Validate format — stale entries may lack `parameters` on functions
      const isValid = parsed.functions.every((fn) => 'parameters' in fn);
      if (!isValid) {
        console.warn(
          `[ArtifactService] Stale unified cache entry for ${classId}, discarding`
        );
        getArtifactStorageService().delete(key);
        return null;
      }

      const artifact = restoreBytecodeBuffers(parsed);
      this.memoryCache.set(key, artifact);
      return artifact;
    } catch {
      return null;
    }
  }

  /** Save artifact to unified cache (memory + IndexedDB, fire-and-forget). */
  private saveToCache(classId: string, artifact: ContractArtifact): void {
    const key = `${CACHE_PREFIX}:${classId}`;
    this.memoryCache.set(key, artifact);

    const serialized = JSON.stringify(prepareArtifactForStorage(artifact));
    getArtifactStorageService()
      .save(key, serialized)
      .catch((err) => {
        console.warn('[ArtifactService] Failed to persist unified cache:', err);
      });
  }

  /** Resolve a single contract from a normalized source */
  private async loadFromSource(
    contractName: string,
    source: NormalizedArtifactSource,
    classId?: string
  ): Promise<ContractLoadResult> {
    switch (source.type) {
      case 'local':
        return { artifact: source.artifact, sourceLabel: 'local' };
      case 'registry': {
        if (!classId) {
          throw new Error(
            'Registry source requires a classId but none was provided'
          );
        }
        const result = await ArtifactRegistryService.getInstance(
          source.url
        ).getArtifact(classId);
        return {
          artifact: result.artifact,
          sourceLabel: 'registry',
        };
      }
    }
  }
}
