import { createContractConfig } from '@contract-registry';
import { collectFeatureContracts } from '../features';

/**
 * Aggregation entry point — collects contract configs from all registered features.
 *
 * Individual contract definitions live in their respective feature modules
 * (e.g., src/features/mint/config/contracts.ts).
 *
 * Contract entries are collected from discovered feature modules.
 * Add your own contracts below — each entry needs:
 *   address          — function returning the contract address
 *   deployParams     — function returning deployment parameters
 *   artifactSources  — ordered fallback chain of artifact sources (first success wins)
 *
 * Optional fields:
 *   classId          — class ID for registry lookups
 *   lazyRegister     — if true, register on-demand instead of at startup
 *
 * @see src/features/registry.ts for the collection mechanism
 */
export const contractsConfig = createContractConfig({
  ...collectFeatureContracts(),
});
