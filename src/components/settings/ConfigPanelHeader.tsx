import React from 'react';
import { Settings } from 'lucide-react';
import { iconSize } from '../../utils';

export interface ConfigPanelHeaderProps {
  displayName: string;
  description?: string;
  action?: React.ReactNode;
}

const styles = {
  container: 'flex items-center gap-3 md:gap-4',
  left: 'flex items-center gap-3 md:gap-4 flex-1 min-w-0',
  icon: 'w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[14px] flex items-center justify-center bg-[var(--accent-primary)]/20 text-lg md:text-[22px] shrink-0',
  content: 'flex flex-col gap-0.5 md:gap-1 min-w-0',
  title: 'text-xl md:text-2xl font-bold text-default truncate',
  subtitle: 'text-xs md:text-sm text-muted',
} as const;

export const ConfigPanelHeader: React.FC<ConfigPanelHeaderProps> = ({
  displayName,
  description,
  action,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <div className={styles.icon}>
          <Settings size={iconSize('lg')} />
        </div>
        <div className={styles.content}>
          <span className={styles.title}>{displayName} Configuration</span>
          <span className={styles.subtitle}>
            {description || 'Environment settings'}
          </span>
        </div>
      </div>
      {action}
    </div>
  );
};
