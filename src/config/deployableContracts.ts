/**
 * Deployable Contracts Configuration.
 * See docs/contract-ui.md for documentation.
 */
import tokenDevnet from '../artifacts/devnet/token_contract-Token.json';
import tokenSandbox from '../artifacts/sandbox/token_contract-Token.json';

import {
  loadDeployableContracts,
  type DeployableContractConfig,
} from '../utils/deployableContracts';

/**
 * ==========================================
 * USER CONFIGURATION - Add new contracts here
 * ==========================================
 *
 * Each entry needs:
 *   - id: Unique identifier
 *   - label: Display name shown in UI
 *   - artifact: Imported artifact JSON
 *   - network: (optional) Filter by network name
 *   - labelField: (optional) Constructor param to distinguish multiple deployments (e.g., 'name' for Token)
 */
const DEPLOYABLE_CONTRACTS_CONFIG: DeployableContractConfig[] = [
  {
    id: 'token-devnet',
    label: 'Token Contract',
    artifact: tokenDevnet,
    network: 'devnet',
    labelField: 'name',
  },
  {
    id: 'token-sandbox',
    label: 'Token Contract',
    artifact: tokenSandbox,
    network: 'sandbox',
    labelField: 'name',
  },
];

/**
 * Processed deployable contracts with extracted constructors.
 * Do not modify - this is auto-generated from the config above.
 */
export const DEPLOYABLE_CONTRACTS = loadDeployableContracts(DEPLOYABLE_CONTRACTS_CONFIG);
