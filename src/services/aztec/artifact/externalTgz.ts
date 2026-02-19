import {
  loadContractArtifact,
  type ContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import { getContractClassFromArtifact } from '@aztec/aztec.js/contracts';
import { ArtifactErrorFactory } from '../../../utils/errors';
import { extractTgz, type TarEntry } from '../../../utils/tar';

/** Timeout for fetching a tgz package (30 seconds) */
const TGZ_FETCH_TIMEOUT_MS = 30_000;

/** Maximum number of fetch attempts before giving up */
const TGZ_MAX_ATTEMPTS = 2;

/** Delay before retrying a failed fetch (ms) */
const TGZ_RETRY_DELAY_MS = 1_500;

/** In-flight tgz fetch+extract dedup map (keyed by tgz URL) */
const inflightExtractions = new Map<
  string,
  Promise<Map<string, ContractArtifact>>
>();

interface ExternalArtifactResult {
  artifact: ContractArtifact;
  sourceLabel: string;
}

/**
 * Load a single contract artifact from a tgz URL.
 * Fetches tgz (deduped across concurrent calls), extracts all artifacts,
 * and returns the requested one. Caching is handled by the unified cache
 * in ArtifactService.
 */
export async function loadExternalArtifact(
  tgzUrl: string,
  contractName: string,
  classId?: string
): Promise<ExternalArtifactResult> {
  contractName = contractName.toLowerCase();

  // Fetch with dedup
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

  // Return requested (verify classId if provided)
  const artifact = allArtifacts.get(contractName);
  if (!artifact) {
    throw ArtifactErrorFactory.contractNotInPackage(contractName, tgzUrl);
  }
  if (classId && !(await verifyClassId(artifact, classId))) {
    const computed = await computeClassId(artifact);
    throw ArtifactErrorFactory.classIdMismatch(classId, computed);
  }
  return { artifact, sourceLabel: 'external' };
}

/** Fetch with a single retry on transient failures (network errors, 5xx). */
async function fetchWithRetry(tgzUrl: string): Promise<ArrayBuffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TGZ_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(tgzUrl, {
        signal: AbortSignal.timeout(TGZ_FETCH_TIMEOUT_MS),
      });
      if (response.ok) {
        return await response.arrayBuffer();
      }
      // 4xx errors (except 429) are not retriable – stop immediately
      if (response.status < 500 && response.status !== 429) {
        lastError = ArtifactErrorFactory.fetchFailed(
          response.status,
          response.statusText
        );
        break;
      }
      lastError = ArtifactErrorFactory.fetchFailed(
        response.status,
        response.statusText
      );
    } catch (err) {
      lastError = err;
    }
    if (attempt < TGZ_MAX_ATTEMPTS) {
      console.warn(
        `[externalTgz] Fetch attempt ${attempt} failed, retrying in ${TGZ_RETRY_DELAY_MS}ms...`
      );
      await new Promise((r) => setTimeout(r, TGZ_RETRY_DELAY_MS));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : ArtifactErrorFactory.tgzFetchFailed(tgzUrl, lastError);
}

/**
 * Fetch a tgz, extract, and parse all contract artifacts from it.
 * Retries once on transient failures (network errors, 5xx).
 * Returns a Map of lowercase contract name → ContractArtifact.
 */
async function fetchAndExtractTgz(
  tgzUrl: string
): Promise<Map<string, ContractArtifact>> {
  const buffer = await fetchWithRetry(tgzUrl);

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

async function computeClassId(artifact: ContractArtifact): Promise<string> {
  const contractClass = await getContractClassFromArtifact(artifact);
  return contractClass.id.toString();
}

async function verifyClassId(
  artifact: ContractArtifact,
  expectedClassId: string
): Promise<boolean> {
  const computed = await computeClassId(artifact);
  return computed === expectedClassId;
}
