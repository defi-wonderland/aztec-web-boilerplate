import { type ArtifactOverrides } from '../../../contract-registry/helpers';
import { ArtifactRegistryService } from '../artifactRegistry';
import type { NetworkConfig } from '../../../config/networks/types';

export type { ArtifactOverrides };

export interface LoadArtifactsResult {
  artifacts: ArtifactOverrides | null;
  elapsedMs: number;
  source: 'local' | 'registry';
}

/**
 * Service for loading contract artifacts based on network configuration.
 *
 * Responsibilities:
 * - Determines artifact source (local vs registry) from config
 * - Fetches artifacts from external registry when needed
 * - Delegates caching to ArtifactRegistryService
 *
 * For 'local' mode: Returns null (artifacts come from contractsConfig)
 * For 'registry' mode: Fetches from external registry using classIds
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
   * Load artifacts for a network configuration.
   *
   * @returns LoadArtifactsResult with artifacts (null for local mode)
   * @throws Error if registry mode but missing required config
   */
  async loadArtifacts(config: NetworkConfig): Promise<LoadArtifactsResult> {
    const start = performance.now();

    if (config.artifactSource === 'local') {
      return {
        artifacts: null,
        elapsedMs: performance.now() - start,
        source: 'local',
      };
    }

    const artifacts = await this.fetchFromRegistry(config);
    return {
      artifacts,
      elapsedMs: performance.now() - start,
      source: 'registry',
    };
  }

  private async fetchFromRegistry(
    config: NetworkConfig
  ): Promise<ArtifactOverrides> {
    const registryUrl = config.artifactRegistryUrl;
    if (!registryUrl) {
      throw new Error(
        `[ArtifactService] artifactRegistryUrl required for registry mode (${config.name})`
      );
    }

    const classIds = config.classIds;
    if (!classIds || Object.keys(classIds).length === 0) {
      throw new Error(
        `[ArtifactService] classIds required for registry mode (${config.name})`
      );
    }

    const registryService = ArtifactRegistryService.getInstance(registryUrl);
    const entries = Object.entries(classIds);

    const artifacts = await Promise.all(
      entries.map(([, classId]) => registryService.getArtifact(classId))
    );

    const result: ArtifactOverrides = {};
    entries.forEach(([contractName], index) => {
      result[contractName] = artifacts[index];
    });

    return result;
  }

  /**
   * Clear all cached artifacts (memory and storage).
   * Useful when switching networks.
   */
  async clearCache(registryUrl?: string): Promise<void> {
    if (registryUrl) {
      const service = ArtifactRegistryService.getInstance(registryUrl);
      await service.clearStorage();
    }
  }
}
