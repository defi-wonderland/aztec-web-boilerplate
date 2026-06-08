// Aztec node client service.
// createAztecNodeClient(VITE_AZTEC_NODE_URL) + getChainInfo helper.
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { Fr } from '@aztec/aztec.js/fields';
import type { ChainInfo } from '@aztec/aztec.js/account';

/** Create a JSON-RPC client against the Aztec node (testnet via env). */
export function createNode(url: string): AztecNode {
  return createAztecNodeClient(url);
}

/**
 * Derive the `ChainInfo` ({ chainId, version } as `Fr`) from the node.
 * The external connector needs it for `WalletManager.getAvailableWallets`.
 */
export async function getChainInfo(node: AztecNode): Promise<ChainInfo> {
  const { l1ChainId, rollupVersion } = await node.getNodeInfo();
  return {
    chainId: new Fr(l1ChainId),
    version: new Fr(rollupVersion),
  };
}
