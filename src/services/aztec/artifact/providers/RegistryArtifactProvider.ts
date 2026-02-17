import { ArtifactRegistryService } from '../../artifactRegistry';
import type { IArtifactProvider, ArtifactProviderResult } from './types';

/**
 * Registry artifact provider — fetches a single contract artifact from an
 * external registry using its classId. Wraps ArtifactRegistryService for
 * the 3-tier cache (memory → IndexedDB → network).
 */
export class RegistryArtifactProvider implements IArtifactProvider {
  constructor(
    private registryUrl: string,
    private classId: string
  ) {}

  async loadArtifacts(
    contractNames: string[]
  ): Promise<ArtifactProviderResult> {
    const registryService = ArtifactRegistryService.getInstance(
      this.registryUrl
    );

    const result = await registryService.getArtifact(this.classId);

    const artifacts: ArtifactProviderResult['artifacts'] = {};
    // Assign the fetched artifact to each requested contract name
    for (const name of contractNames) {
      artifacts[name] = result.artifact;
    }

    return { artifacts, sourceLabel: `registry:${result.source}` };
  }
}
