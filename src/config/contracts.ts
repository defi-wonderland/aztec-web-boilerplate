import { createContractConfig } from '../contract-registry';
import { boilerplateContracts } from './boilerplateContracts';

/**
 * Contract registry configuration.
 *
 * The boilerplate ships with Dripper and Token (see boilerplateContracts.ts).
 * Add your own contracts below — each entry needs:
 *   address          — function returning the contract address
 *   deployParams     — function returning deployment parameters
 *   artifactSources  — ordered fallback chain of artifact sources (first success wins)
 *
 * Optional fields:
 *   contract         — typed contract class (for TypeScript inference)
 *   classId          — class ID for registry lookups
 *   lazyRegister     — if true, register on-demand instead of at startup
 */
export const contractsConfig = createContractConfig({
  // Boilerplate demo contracts (Dripper + Token)
  ...boilerplateContracts,

  // Add your own contracts here:
  // myContract: {
  //   contract: MyContract,
  //   address: (config) => config.myContractAddress,
  //   deployParams: (config) => ({ ... }),
  // },
});
