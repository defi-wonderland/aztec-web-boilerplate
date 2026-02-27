/**
 * Contract registration helper for the demo wallet (Aztec Keychain).
 *
 * The demo wallet's PXE (running in Electron) doesn't share state with the
 * app's local PXE / ContractRegistry. Before calling Contract.at().simulate()
 * or .send(), we need to register the contract on the remote PXE.
 *
 * Flow: Aztec Node → getContract(address) → wallet.registerContract(instance, artifact)
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { NetworkService } from '../../aztec-wallet/services/aztec/network/NetworkService';
import { getNetworkStore } from '../../aztec-wallet/store/network';

/** Addresses we've already registered on the current demo wallet session */
const registeredContracts = new Set<string>();

/**
 * Ensure a contract is registered on the demo wallet's remote PXE.
 * No-op if already registered in this session.
 */
export async function ensureDemoWalletContractRegistered(
  wallet: Wallet,
  address: string,
  artifact: ContractArtifact
): Promise<void> {
  if (registeredContracts.has(address)) {
    return;
  }

  const { nodeUrl } = getNetworkStore().currentConfig;
  const nodeClient = NetworkService.getNodeClient(nodeUrl);
  const contractAddress = AztecAddress.fromString(address);

  // Fetch the deployed contract instance from the Aztec node
  const instance = await nodeClient.getContract(contractAddress);
  if (!instance) {
    throw new Error(
      `Contract ${address} not found on Aztec node. ` +
        'Ensure the contract is deployed on the current network.'
    );
  }

  console.log(
    `[DemoWallet] Registering contract on remote PXE: ${artifact.name} at ${address}`
  );

  await wallet.registerContract(instance, artifact);
  registeredContracts.add(address);

  console.log(
    `[DemoWallet] Contract registered successfully: ${artifact.name}`
  );
}

/**
 * Clear the registration cache (e.g. on disconnect or network switch).
 */
export function clearDemoWalletRegistrationCache(): void {
  registeredContracts.clear();
}
