import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { getContractClassFromArtifact } from '@aztec/aztec.js/contracts';
import { ArtifactErrorFactory } from '@/utils/errors';
import { restoreBytecodeBuffers } from '@/utils/storage';
import type {
  ArtifactResult,
  GetArtifactOptions,
  SerializedArtifact,
} from '../../types/artifactRegistry';

export class ArtifactRegistryService {
  private static instances = new Map<string, ArtifactRegistryService>();

  private memoryCache = new Map<string, ContractArtifact>();
  private stringCache = new Map<string, string>();
  private pendingRequests = new Map<string, Promise<ArtifactResult>>();

  private constructor(private baseUrl: string) {}

  static getInstance(baseUrl: string): ArtifactRegistryService {
    const existing = this.instances.get(baseUrl);
    if (existing) {
      return existing;
    }
    const instance = new ArtifactRegistryService(baseUrl);
    this.instances.set(baseUrl, instance);
    return instance;
  }

  async getArtifact(
    classId: string,
    options: GetArtifactOptions = {}
  ): Promise<ArtifactResult> {
    const memoryCached = this.memoryCache.get(classId);
    if (memoryCached) {
      return { artifact: memoryCached, source: 'memory' };
    }

    const pending = this.pendingRequests.get(classId);
    if (pending) {
      const result = await pending;
      return { artifact: result.artifact, source: result.source };
    }

    const request = this.loadArtifact(classId, options);
    this.pendingRequests.set(classId, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(classId);
    }
  }

  getStringifiedArtifact(classId: string): string | null {
    const cached = this.stringCache.get(classId);
    if (cached) {
      return cached;
    }

    const artifact = this.memoryCache.get(classId);
    if (artifact) {
      const stringified = JSON.stringify(artifact);
      this.stringCache.set(classId, stringified);
      return stringified;
    }

    return null;
  }

  private async loadArtifact(
    classId: string,
    options: GetArtifactOptions = {}
  ): Promise<ArtifactResult> {
    const artifact = await this.fetchFromRegistry(classId, options);
    this.memoryCache.set(classId, artifact);
    return { artifact, source: 'network' };
  }

  private async fetchFromRegistry(
    classId: string,
    options: GetArtifactOptions = {}
  ): Promise<ContractArtifact> {
    const { skipValidation = false } = options;
    const url = `${this.baseUrl}/api/artifacts/${classId}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw ArtifactErrorFactory.notFound(classId);
      }
      throw ArtifactErrorFactory.fetchFailed(
        response.status,
        response.statusText
      );
    }

    const rawArtifact = (await response.json()) as SerializedArtifact;
    const artifact = restoreBytecodeBuffers(rawArtifact);
    if (!skipValidation) {
      await this.validateArtifact(artifact, classId);
    }
    return artifact;
  }

  private async validateArtifact(
    artifact: ContractArtifact,
    expectedClassId: string
  ): Promise<void> {
    if (!artifact.name || !Array.isArray(artifact.functions)) {
      throw ArtifactErrorFactory.invalidStructure(
        `Invalid artifact structure for classId: ${expectedClassId}`
      );
    }

    const contractClass = await getContractClassFromArtifact(artifact);
    const computedClassId = contractClass.id.toString();

    if (computedClassId !== expectedClassId) {
      throw ArtifactErrorFactory.classIdMismatch(
        expectedClassId,
        computedClassId
      );
    }
  }
}
