// Toast context + hook. Kept separate from <ToastProvider> so the provider file
// only exports a component (required by react-refresh / fast refresh).
import { createContext, useContext } from 'react';

export interface ToastOptions {
  title: string;
  /** Auto-dismiss after ms; falls back to the provider default. */
  duration?: number;
}

export interface ToastContextValue {
  /** Raise a toast. Pass a string for the common title-only case. */
  toast: (opts: ToastOptions | string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** Access the imperative toast API. Must be used under <ToastProvider>. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
