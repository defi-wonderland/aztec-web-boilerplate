import type { ContractArtifact } from '@aztec/aztec.js/abi';
import {
  normalizeArtifactSource,
  type ArtifactSourceConfig,
  type NormalizedArtifactSource,
} from '../../../types/artifactSource';
import {
  RegistryArtifactProvider,
  ExternalArtifactProvider,
  type IArtifactProvider,
} from './providers';
import type { NetworkConfig } from '../../../config/networks/types';
import type { ContractConfigMap } from '../../../contract-registry/types';

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
    const results = await Promise.all(
      contractNames.map((name) => {
        const contractDef = contracts[name];
        const sources = contractDef.artifactSources(config);
        const classId = contractDef.classId?.(config);
        return this.loadWithFallback(name, sources, classId);
      })
    );

    // Merge results
    const artifacts: ResolvedArtifacts = {};
    const sourceLabels: string[] = [];

    contractNames.forEach((name, i) => {
      const { artifact, sourceLabel } = results[i];
      artifacts[name] = artifact;
      if (sourceLabel !== 'local' && !sourceLabels.includes(sourceLabel)) {
        sourceLabels.push(sourceLabel);
      }
    });

    return {
      artifacts,
      elapsedMs: performance.now() - start,
      sourceLabel: sourceLabels.length > 0 ? sourceLabels.join(', ') : 'local',
    };
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
        const provider = this.createProvider(source, classId);
        const result = await provider.loadArtifacts([contractName]);
        const artifact = result.artifacts[contractName];
        if (artifact) {
          console.log(
            `[ArtifactService] "${contractName}" — loaded from ${label}`
          );
          return { artifact, sourceLabel: result.sourceLabel };
        }
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
      case 'external':
        return `external (${source.url})`;
      case 'local':
        return 'bundled artifact';
    }
  }

  /** Create the appropriate provider for a source config */
  private createProvider(
    source: Extract<
      NormalizedArtifactSource,
      { type: 'registry' | 'external' }
    >,
    classId?: string
  ): IArtifactProvider {
    switch (source.type) {
      case 'registry':
        if (!classId) {
          throw new Error(
            'Registry source requires a classId but none was provided'
          );
        }
        return new RegistryArtifactProvider(source.url, classId);
      case 'external':
        return new ExternalArtifactProvider(source.url);
    }
  }
}
