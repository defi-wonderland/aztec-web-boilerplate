import { AztecNetwork } from './network';

export type DeployableContractConfig = {
  id: string;
  label: string;
  network?: AztecNetwork;
  /** Optional field name to use as the display label in saved contracts. */
  labelField?: string;
  /** Local artifact JSON (used as fallback when classId registry lookup fails). */
  artifact?: unknown;
  /** Class ID to fetch artifact from registry. */
  classId?: string;
};
