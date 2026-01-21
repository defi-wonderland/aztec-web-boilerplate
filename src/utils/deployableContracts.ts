import {
  parseArtifactSource,
  type ParsedFunction,
} from './contractInteraction';
import { toTitleCase } from './string';
import type { AztecNetwork } from '../config/networks/constants';

export type DeployableContractConfig = {
  id: string;
  label: string;
  artifact: unknown;
  network?: AztecNetwork;
  //Optional field name to use as the display label in saved contracts.
  labelField?: string;
};

/**
 * Constructor definition - extends ParsedFunction with a friendly label.
 */
export type ContractConstructor = ParsedFunction & {
  /** Human-friendly label for the constructor */
  label: string;
};

/**
 * Fully processed deployable contract with extracted constructors.
 */
export type DeployableContract = {
  id: string;
  label: string;
  artifactJson: string;
  constructors: ContractConstructor[];
  network?: AztecNetwork;
  labelField?: string;
};

/**
 * Extract constructors from artifact JSON using existing parsing logic.
 * Constructors are functions with the 'abi_initializer' attribute.
 */
const extractConstructorsFromArtifact = (
  artifactJson: string
): ContractConstructor[] => {
  try {
    const parsed = parseArtifactSource(artifactJson);

    const initializers = parsed.functions.filter((fn) =>
      fn.attributes.includes('abi_initializer')
    );

    return initializers.map((fn) => {
      const labelPart = fn.name
        .replace(/^constructor_?/, '')
        .replace(/_/g, ' ')
        .trim();
      const label = labelPart ? toTitleCase(labelPart) : 'Default';

      return {
        ...fn,
        label,
      };
    });
  } catch {
    return [];
  }
};

const createDeployableContract = (
  config: DeployableContractConfig
): DeployableContract => {
  const artifactJson = JSON.stringify(config.artifact);
  const constructors = extractConstructorsFromArtifact(artifactJson);

  return {
    id: config.id,
    label: config.label,
    artifactJson,
    constructors,
    network: config.network,
    labelField: config.labelField,
  };
};

export const loadDeployableContracts = (
  configs: DeployableContractConfig[]
): DeployableContract[] => {
  return configs.map(createDeployableContract);
};

export const getDeployableContractsForNetwork = (
  contracts: DeployableContract[],
  networkName?: AztecNetwork
): DeployableContract[] => {
  if (!networkName) {
    return contracts;
  }
  return contracts.filter(
    (contract) => !contract.network || contract.network === networkName
  );
};

export const findDeployableContract = (
  contracts: DeployableContract[],
  contractId: string
): DeployableContract | undefined => {
  return contracts.find((contract) => contract.id === contractId);
};

export const findConstructor = (
  contract: DeployableContract,
  constructorName: string
): ContractConstructor | undefined => {
  return contract.constructors.find((c) => c.name === constructorName);
};

/**
 * Build a display label for a deployed contract using form values.
 * Uses explicit `labelField` from contract config if specified.
 */
export const buildDeploymentLabel = (
  contract: DeployableContract,
  formValues: Record<string, string>
): string => {
  const customValue = contract.labelField
    ? formValues[contract.labelField]?.trim()
    : null;

  // Extract base contract name (e.g., "Token Contract (Devnet)" -> "Token")
  const baseLabel = contract.label.split(' ')[0] ?? contract.label;

  if (customValue) {
    return `${baseLabel}: ${customValue}`;
  }

  return baseLabel;
};
