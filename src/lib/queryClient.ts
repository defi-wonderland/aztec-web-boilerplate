// Shared QueryClient instance for @tanstack/react-query.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // On-chain data: avoid aggressive refetch on focus/reconnect.
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
