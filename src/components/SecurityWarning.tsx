import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { iconSize } from '../utils';
import { Button } from './ui';

interface SecurityWarningProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
}

const styles = {
  wrapper: 'w-full rounded-lg bg-amber-200/15 border border-amber-500/40 p-4',
  content: 'flex items-start gap-3',
  icon: 'text-amber-600 dark:text-amber-500 shrink-0 mt-0.5',
  textWrapper: 'flex-1 min-w-0',
  title: 'font-semibold text-amber-900 dark:text-amber-400',
  detail: 'text-sm text-amber-800 dark:text-amber-300 mt-1 block',
  dismissButton:
    'text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-500/20',
} as const;

export const SecurityWarning: React.FC<SecurityWarningProps> = ({
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <AlertTriangle
          size={iconSize('md')}
          className={styles.icon}
          aria-hidden="true"
        />
        <div className={styles.textWrapper}>
          <strong className={styles.title}>Test Only</strong>
          <span className={styles.detail}>
            Embedded wallet keys are stored locally. Only use for development
            and testing.
          </span>
        </div>
        {showDismiss && (
          <Button
            variant="icon"
            size="icon"
            onClick={handleDismiss}
            aria-label="Dismiss warning"
            className={styles.dismissButton}
          >
            <X size={iconSize()} />
          </Button>
        )}
      </div>
    </div>
  );
};
