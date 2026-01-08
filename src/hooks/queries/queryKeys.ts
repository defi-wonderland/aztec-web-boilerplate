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
} as const;

/**
 * Type helpers for query keys
 */
export type TokenBalanceKey = ReturnType<typeof queryKeys.token.balance>;
