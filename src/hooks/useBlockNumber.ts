// useBlockNumber: polls the current block via react-query.
// Reads node.getBlockNumber() from the store. BlockNumber is a branded number;
// treat it as a number in the UI.
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../state/walletStore';

export function useBlockNumber() {
  const node = useWalletStore((s) => s.node);
  const networkId = useWalletStore((s) => s.networkId);

  return useQuery({
    // Key on the network so switching nodes refetches instead of showing stale data.
    queryKey: ['blockNumber', networkId],
    queryFn: async () => {
      if (!node) {
        throw new Error('Node not initialized');
      }
      return node.getBlockNumber();
    },
    enabled: !!node,
    refetchInterval: 10_000,
  });
}
