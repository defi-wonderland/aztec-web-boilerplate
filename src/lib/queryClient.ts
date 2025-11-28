import { QueryClient } from '@tanstack/react-query';

/**
 * Default configuration for React Query optimized for blockchain data.
 * 
 * - staleTime: 30s - blockchain data changes with each block
 * - gcTime: 5min - keep unused data in cache for quick re-access
 * - retry: 2 attempts with exponential backoff for transient failures
 * - refetchOnWindowFocus: true - ensure fresh data when user returns
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

