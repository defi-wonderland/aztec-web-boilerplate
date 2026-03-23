import React, { useCallback, useRef, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToast, type ToastVariant } from '../../hooks/context/useToast';
import { iconSize } from '../../utils';
import {
  Toast,
  ToastProvider as RadixToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
} from './Toast';

/**
 * Styles for the Toaster component
 */
const styles = {
  toastContent: 'flex items-start gap-3 flex-1 min-w-0',
  iconWrapper: 'shrink-0 mt-0.5',
  textWrapper: 'flex-1 min-w-0',
  actionWrapper: 'shrink-0 ml-2',
  spinner:
    'h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent',
} as const;

const ICON_SIZE = iconSize('md');

/**
 * Loading spinner component
 */
const LoadingSpinner: React.FC = () => <div className={styles.spinner} />;

/**
 * Icon mapping for toast variants
 */
const VARIANT_ICONS: Record<ToastVariant, React.FC | null> = {
  success: () => <CheckCircle size={ICON_SIZE} />,
  error: () => <XCircle size={ICON_SIZE} />,
  warning: () => <AlertTriangle size={ICON_SIZE} />,
  info: () => <Info size={ICON_SIZE} />,
  loading: LoadingSpinner,
  default: null,
};

/** Duration of exit animation in ms - must match CSS animation duration in globals.css */
const TOAST_EXIT_DURATION = 300;

/**
 * Toaster component - renders all active toasts.
 * Must be placed inside ToastProvider.
 *
 * @example
 * ```tsx
 * // In your app root
 * <ToastProvider>
 *   <App />
 *   <Toaster />
 * </ToastProvider>
 * ```
 */
export const Toaster: React.FC = () => {
  const { toasts, removeToast } = useToast();
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const handleOpenChange = useCallback(
    (toastId: string, open: boolean) => {
      if (!open) {
        // Delay removal to allow exit animation to complete
        const timeout = setTimeout(() => {
          removeToast(toastId);
          timeoutsRef.current.delete(toastId);
        }, TOAST_EXIT_DURATION);
        timeoutsRef.current.set(toastId, timeout);
      }
    },
    [removeToast]
  );

  return (
    <RadixToastProvider swipeDirection="right">
      {toasts.map((toast) => {
        const IconComponent = toast.icon
          ? null
          : VARIANT_ICONS[toast.variant ?? 'default'];

        return (
          <Toast
            key={toast.id}
            variant={toast.variant}
            duration={toast.duration}
            onOpenChange={(open) => handleOpenChange(toast.id, open)}
          >
            <div className={styles.toastContent}>
              {toast.icon && (
                <div className={styles.iconWrapper}>{toast.icon}</div>
              )}
              {IconComponent && (
                <div className={styles.iconWrapper}>
                  <IconComponent />
                </div>
              )}
              <div className={styles.textWrapper}>
                <ToastTitle>{toast.title}</ToastTitle>
                {toast.description && (
                  <ToastDescription>{toast.description}</ToastDescription>
                )}
              </div>
            </div>

            {toast.action && (
              <ToastAction
                altText={toast.action.label}
                onClick={toast.action.onClick}
                className={styles.actionWrapper}
              >
                {toast.action.label}
              </ToastAction>
            )}

            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </RadixToastProvider>
  );
};
