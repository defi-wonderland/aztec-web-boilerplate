import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

/**
 * Toast variant types
 */
export type ToastVariant =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'loading';

/**
 * Toast data structure
 */
export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

/**
 * Toast input for creating new toasts (id is auto-generated)
 */
export type ToastInput = Omit<ToastData, 'id'>;

/**
 * Loading toast result - provides methods to resolve the loading state
 */
export interface LoadingToastResult {
  /** Dismiss loading and show success toast */
  success: (title: string, description?: string) => void;
  /** Dismiss loading and show error toast */
  error: (title: string, description?: string) => void;
  /** Dismiss loading toast without showing another */
  dismiss: () => void;
}

/**
 * Toast context value
 */
interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: ToastInput) => string;
  removeToast: (id: string) => void;
  removeAll: () => void;
  // Convenience methods
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  /** Show a persistent loading toast that can be resolved with success/error */
  loading: (title: string, description?: string) => LoadingToastResult;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Generate unique ID for toasts
 */
const generateId = () => crypto.randomUUID();

/**
 * Default toast duration in milliseconds
 */
const DEFAULT_DURATION = 5000;

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Toast Provider - wraps your app to enable toast notifications.
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 *   <Toaster />
 * </ToastProvider>
 * ```
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((input: ToastInput): string => {
    const id = generateId();
    const toast: ToastData = {
      ...input,
      id,
      variant: input.variant ?? 'default',
      duration: input.duration ?? DEFAULT_DURATION,
    };

    setToasts((prev) => [...prev, toast]);

    // Note: Auto-remove is handled by Radix Toast's duration prop
    // which properly triggers the exit animation before removal

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const removeAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback(
    (title: string, description?: string) =>
      addToast({ title, description, variant: 'success' }),
    [addToast]
  );

  const error = useCallback(
    (title: string, description?: string) =>
      addToast({ title, description, variant: 'error' }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, description?: string) =>
      addToast({ title, description, variant: 'warning' }),
    [addToast]
  );

  const info = useCallback(
    (title: string, description?: string) =>
      addToast({ title, description, variant: 'info' }),
    [addToast]
  );

  const loading = useCallback(
    (title: string, description?: string): LoadingToastResult => {
      const id = addToast({
        title,
        description,
        variant: 'loading',
        duration: Infinity, // Persist until manually dismissed
      });

      return {
        success: (successTitle: string, successDescription?: string) => {
          removeToast(id);
          success(successTitle, successDescription);
        },
        error: (errorTitle: string, errorDescription?: string) => {
          removeToast(id);
          error(errorTitle, errorDescription);
        },
        dismiss: () => {
          removeToast(id);
        },
      };
    },
    [addToast, removeToast, success, error]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      addToast,
      removeToast,
      removeAll,
      success,
      error,
      warning,
      info,
      loading,
    }),
    [
      toasts,
      addToast,
      removeToast,
      removeAll,
      success,
      error,
      warning,
      info,
      loading,
    ]
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
};

/**
 * Hook to access toast functionality.
 * Must be used within a ToastProvider.
 *
 * @example
 * ```tsx
 * const { success, error, addToast } = useToast();
 *
 * // Simple usage
 * success('Saved!', 'Your changes have been saved.');
 * error('Failed', 'Something went wrong.');
 *
 * // Advanced usage
 * addToast({
 *   title: 'New message',
 *   description: 'You have a new notification',
 *   variant: 'info',
 *   action: {
 *     label: 'View',
 *     onClick: () => navigate('/messages'),
 *   },
 * });
 * ```
 */
export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};
