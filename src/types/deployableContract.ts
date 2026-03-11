import type { ArtifactSourceConfig } from './artifactSource';
import type { AztecNetwork } from './network';

/**
 * Configuration for a deployable contract.
 *
 * At least one of `artifact` or `classId` must be provided.
 * When both are present, classId is used for registry lookup and
 * artifact serves as a local fallback.
 */
type DeployableContractConfigBase = {
  id: string;
  label: string;
  network?: AztecNetwork;
  /** Optional field name to use as the display label in saved contracts. */
  labelField?: string;
  artifactSources?: ArtifactSourceConfig[];
};

export type DeployableContractConfig = DeployableContractConfigBase &
  (
    | { artifact: unknown; classId?: string }
    | { classId: string; artifact?: unknown }
  );
