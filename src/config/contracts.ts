import { boilerplateContracts } from '../components/contract-interaction/boilerplateContracts';
import { createContractConfig } from '../contract-registry';

/**
 * Contract registry configuration.
 *
 * The boilerplate ships with Dripper and Token (see boilerplateContracts.ts).
 * Add your own contracts below — each entry needs:
 *   constructorArtifact  — constructor function name or ABI
 *   constructorArgs      — static array or function receiving deployments map
 *   artifactSources      — ordered fallback chain (first success wins)
 *
 * Optional fields:
 *   contract       — typed contract class (enables autocomplete on useContract)
 *   classId        — class ID for registry lookups
 *   lazyRegister   — if true, register on-demand instead of at startup
 *
 * Also add your contract's deployment data to each network's deployment file
 * in src/config/deployments/ (address, salt, deployer).
 */
export const contractsConfig = createContractConfig({
  // Boilerplate demo contracts (Dripper + Token)
  ...boilerplateContracts,

  // Add your own contracts here:
  // myContract: {
  //   constructorArtifact: 'constructor',
  //   constructorArgs: [],
  //   artifactSources: [{ local: MyContract.artifact }],
  // },
});
