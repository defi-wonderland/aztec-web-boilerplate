import React, { useState } from 'react';
import { WifiOff, X, RefreshCw } from 'lucide-react';
import { iconSize } from '../utils';
import { Button } from './ui';

interface NetworkErrorProps {
  error?: string | null;
  networkName?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDismiss?: boolean;
}

const styles = {
  wrapper: 'w-full rounded-lg bg-red-200/15 border border-red-500/40 p-4',
  content: 'flex items-start gap-3',
  icon: 'text-red-600 dark:text-red-500 shrink-0 mt-0.5',
  textWrapper: 'flex-1 min-w-0',
  title: 'font-semibold text-red-900 dark:text-red-400',
  detail: 'text-sm text-red-800 dark:text-red-300 mt-1 block',
  actions: 'flex items-center gap-2 shrink-0',
  retryButton:
    'text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/20',
  dismissButton:
    'text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/20',
} as const;

export const NetworkError: React.FC<NetworkErrorProps> = ({
  error,
  networkName,
  onRetry,
  onDismiss,
  showDismiss = true,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  const networkDisplay = networkName || 'Network';

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <WifiOff
          size={iconSize('md')}
          className={styles.icon}
          aria-hidden="true"
        />
        <div className={styles.textWrapper}>
          <strong className={styles.title}>{networkDisplay} Unavailable</strong>
          <span className={styles.detail}>
            {error ||
              `Unable to connect to ${networkDisplay}. Please check your connection or try again later.`}
          </span>
        </div>
        <div className={styles.actions}>
          {onRetry && (
            <Button
              variant="icon"
              size="icon"
              onClick={onRetry}
              aria-label="Retry connection"
              className={styles.retryButton}
            >
              <RefreshCw size={iconSize()} />
            </Button>
          )}
          {showDismiss && (
            <Button
              variant="icon"
              size="icon"
              onClick={handleDismiss}
              aria-label="Dismiss error"
              className={styles.dismissButton}
            >
              <X size={iconSize()} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
