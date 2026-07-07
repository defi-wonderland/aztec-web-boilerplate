// src/hooks/useCounter.ts
// react-query hooks for the Counter contract: a read (useQuery) and a write
// (useMutation), mirroring useBlockNumber. Wallet/account/network come from the
// store; the actual contract calls live in src/contracts/counter.ts.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { TxReceipt } from '@aztec/aztec.js/tx';
import { useWalletStore } from '../state/walletStore';
import { resolveFeePaymentMethod, explainFeeError } from '../contracts/fees';
import { incrementCounter, readCounter } from '../contracts/counter';

/** Read the current counter value. Refetches when the network or contract changes. */
export function useCounterValue(contractAddress: string) {
  const wallet = useWalletStore((s) => s.wallet);
  const from = useWalletStore((s) => s.address);
  const networkId = useWalletStore((s) => s.networkId);

  return useQuery({
    queryKey: ['counter', networkId, contractAddress],
    queryFn: async (): Promise<bigint> => {
      if (!wallet || !from) throw new Error('Wallet not connected');
      return readCounter(wallet, AztecAddress.fromString(contractAddress), from);
    },
    enabled: !!wallet && !!from,
  });
}

/** Increment the counter, then refetch the value on success. */
export function useIncrement(contractAddress: string) {
  const wallet = useWalletStore((s) => s.wallet);
  const from = useWalletStore((s) => s.address);
  const connector = useWalletStore((s) => s.connector);
  const networkId = useWalletStore((s) => s.networkId);
  const qc = useQueryClient();

  return useMutation<TxReceipt, Error>({
    mutationFn: async () => {
      if (!wallet || !from) throw new Error('Wallet not connected');
      // Fee strategy: undefined for external wallets (they pay) or a configured
      // sponsored FPC for the embedded wallet. See contracts/fees.ts.
      const paymentMethod = resolveFeePaymentMethod(connector, networkId);
      try {
        return await incrementCounter(wallet, AztecAddress.fromString(contractAddress), from, paymentMethod);
      } catch (err) {
        throw explainFeeError(err, networkId); // clear message when fees can't be paid
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['counter', networkId, contractAddress] }),
  });
}
