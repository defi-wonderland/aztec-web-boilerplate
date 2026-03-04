/**
 * Deployable Contracts Configuration.
 * See docs/contract-ui.md for documentation.
 */
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import dripperSandbox from '@defi-wonderland/aztec-standards/target/dripper-Dripper.json';
import tokenSandbox from '@defi-wonderland/aztec-standards/target/token_contract-Token.json';
import {
  loadDeployableContracts,
  type DeployableContractConfig,
} from '../utils/deployableContracts';
import { ARTIFACT_REGISTRY_URL, EXTERNAL_TGZ_URL } from './networks/constants';

/**
 * ==========================================
 * USER CONFIGURATION - Add new contracts here
 * ==========================================
 *
 * Each entry needs:
 *   - id: Unique identifier
 *   - label: Display name shown in UI
 *   - artifact: Imported artifact JSON (for local/sandbox)
 *   - classId: Class ID to fetch artifact from registry (for devnet)
 *   - network: (optional) Filter by network name
 *   - labelField: (optional) Constructor param to distinguish multiple deployments (e.g., 'name' for Token)
 *   - artifactSources: (optional) Ordered fallback chain for artifact resolution
 */
const DEPLOYABLE_CONTRACTS_CONFIG: DeployableContractConfig[] = [
  {
    id: 'token-devnet',
    label: 'Token Contract',
    classId:
      '0x1a89e73869a0969d6a14a8eb2ad8c981820302ff64c55b1225fbe29e4bfa99aa',
    network: 'devnet',
    labelField: 'name',
    artifactSources: [
      { registry: ARTIFACT_REGISTRY_URL },
      { external: EXTERNAL_TGZ_URL },
      { local: TokenContract.artifact },
    ],
  },
  {
    id: 'token-sandbox',
    label: 'Token Contract',
    artifact: tokenSandbox,
    network: 'sandbox',
    labelField: 'name',
  },
  {
    id: 'dripper-sandbox',
    label: 'Dripper',
    artifact: dripperSandbox,
    network: 'sandbox',
  },
];

/**
 * Processed deployable contracts with extracted constructors.
 * Do not modify - this is auto-generated from the config above.
 */
export const DEPLOYABLE_CONTRACTS = loadDeployableContracts(
  DEPLOYABLE_CONTRACTS_CONFIG
);
