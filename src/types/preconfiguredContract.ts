import { AztecNetwork } from './network';

export type PreconfiguredContract = {
  id: string;
  label: string;
  address: string;
  network?: AztecNetwork;
  /** Serialized artifact JSON (used as fallback when classId registry lookup fails). */
  artifactJson?: string;
  /** Class ID to fetch artifact from registry. */
  classId?: string;
};
