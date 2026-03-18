/**
 * Contract registration helper for the demo wallet (Aztec Keychain).
 *
 * The demo wallet's PXE (running in Electron) doesn't share state with the
 * app's local PXE / ContractRegistry. Before calling Contract.at().simulate()
 * or .send(), we need to register the contract on the remote PXE.
 *
 * Flow: Aztec Node → getContract(address) → wallet.registerContract(instance, artifact)
 */

import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { NetworkService } from '../../aztec-wallet/services/aztec/network/NetworkService';
import { getNetworkStore } from '../../aztec-wallet/store/network';

/** Addresses we've already registered on the current demo wallet session */
const registeredContracts = new Set<string>();

/** Cached SponsoredFPC address once registered */
let sponsoredFPCAddress: AztecAddress | null = null;

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

  await wallet.registerContract(instance, artifact);
  registeredContracts.add(address);
}

/**
 * Ensure the SponsoredFPC contract is registered on the demo wallet's remote PXE.
 * This is required for fee payment — the wallet needs to know about the SponsoredFPC
 * contract to construct fee payment proofs for transactions.
 *
 * Returns the SponsoredFPC contract address for use with SponsoredFeePaymentMethod.
 */
export async function ensureSponsoredFPCRegistered(
  wallet: Wallet
): Promise<AztecAddress> {
  if (sponsoredFPCAddress) {
    return sponsoredFPCAddress;
  }

  const { SPONSORED_FPC_SALT } = await import('@aztec/constants');
  const { SponsoredFPCContractArtifact } = await import(
    '@aztec/noir-contracts.js/SponsoredFPC'
  );
  const { getContractInstanceFromInstantiationParams } = await import(
    '@aztec/aztec.js/contracts'
  );

  const instance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    { salt: new Fr(SPONSORED_FPC_SALT) }
  );

  // Check if already registered on the remote PXE to avoid duplicate registration
  const key = instance.address.toString();
  if (!registeredContracts.has(key)) {
    await wallet.registerContract(instance, SponsoredFPCContractArtifact);
    registeredContracts.add(key);
  }

  sponsoredFPCAddress = instance.address;
  return sponsoredFPCAddress;
}

/**
 * Clear the registration cache (e.g. on disconnect or network switch).
 */
export function clearDemoWalletRegistrationCache(): void {
  registeredContracts.clear();
  sponsoredFPCAddress = null;
}
