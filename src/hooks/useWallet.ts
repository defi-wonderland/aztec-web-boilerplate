// useWallet: convenience hook that exposes the whole wallet store as a single
// object, so consumers can destructure just what they need:
//
//   const { status, address, connect } = useWallet();
//

import { useShallow } from "zustand/react/shallow";
import { useWalletStore } from "../state/walletStore";

export function useWallet() {
  return useWalletStore(
    useShallow((s) => ({
      // state
      node: s.node,
      networkId: s.networkId,
      status: s.status,
      connector: s.connector,
      address: s.address,
      wallet: s.wallet,
      error: s.error,
      emojiGrid: s.emojiGrid,
      pendingAccounts: s.pendingAccounts,
      // actions (stable references)
      initNetwork: s.initNetwork,
      setNetwork: s.setNetwork,
      connect: s.connect,
      selectAccount: s.selectAccount,
      disconnect: s.disconnect,
      reconnect: s.reconnect,
    }))
  );
}
