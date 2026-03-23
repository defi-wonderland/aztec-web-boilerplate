import type { AztecNetwork } from '../../config/networks/constants';

/**
 * Centralized query key factory for React Query.
 * Using a factory pattern ensures type-safe, consistent query keys across the app.
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */
export const queryKeys = {
  token: {
    all: ['token'] as const,
    balances: () => [...queryKeys.token.all, 'balance'] as const,
    balance: (tokenAddress: string, ownerAddress: string) =>
      [...queryKeys.token.balances(), tokenAddress, ownerAddress] as const,
  },
  feeJuice: {
    all: ['feeJuice'] as const,
    balances: () => [...queryKeys.feeJuice.all, 'balance'] as const,
    balance: (networkName: AztecNetwork, feePayerAddress: string) =>
      [...queryKeys.feeJuice.balances(), networkName, feePayerAddress] as const,
  },
  feePayer: {
    all: ['feePayer'] as const,
    address: (method: string, configHash: string) =>
      [...queryKeys.feePayer.all, 'address', method, configHash] as const,
  },
} as const;

/**
 * Type helpers for query keys
 */
export type TokenBalanceKey = ReturnType<typeof queryKeys.token.balance>;
export type FeeJuiceBalanceKey = ReturnType<typeof queryKeys.feeJuice.balance>;
export type FeePayerAddressKey = ReturnType<typeof queryKeys.feePayer.address>;
