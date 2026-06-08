// AppProviders: every app-wide provider, composed once and mounted in main.tsx.
// Add new global providers here (router, theme, wallet context, …) rather than
// nesting them in main.tsx or scattering them across components.
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { queryClient } from '../lib/queryClient';
import { ToastProvider } from './ToastProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* One app-level Tooltip provider (Radix recommends a single instance). */}
      <Tooltip.Provider delayDuration={150}>
        <ToastProvider>{children}</ToastProvider>
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}
