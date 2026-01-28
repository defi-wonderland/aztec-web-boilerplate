import React from 'react';
import { cn } from '../../utils';

type IconVariant = 'green' | 'purple' | 'amber';
type BadgeVariant = 'online' | 'count';

interface ConfigSectionBadge {
  text: string;
  variant: BadgeVariant;
}

export interface ConfigSectionProps {
  icon: string; // Emoji icon
  iconVariant: IconVariant;
  title: string;
  badge?: ConfigSectionBadge;
  children: React.ReactNode;
  className?: string;
}

const ICON_BG_STYLES: Record<IconVariant, string> = {
  green: 'bg-[#10B981]/20',
  purple: 'bg-[#8B5CF6]/20',
  amber: 'bg-[#F59E0B]/20',
};

const BADGE_STYLES: Record<BadgeVariant, { container: string; text: string }> =
  {
    online: {
      container:
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7]',
      text: 'text-xs font-medium text-[#15803D]',
    },
    count: {
      container: 'px-2.5 py-1 rounded-full bg-[#8B5CF6]/20',
      text: 'text-xs font-medium text-[#8B5CF6]',
    },
  };

const styles = {
  container: 'rounded-2xl overflow-hidden bg-white',
  header:
    'flex items-center gap-3 px-5 py-4 bg-[#F9FAFB] rounded-t-2xl border-b border-[#F3F4F6]',
  iconBox: 'w-8 h-8 rounded-lg flex items-center justify-center text-sm',
  title: 'text-[15px] font-semibold text-[#1A1A1A] flex-1',
  onlineDot: 'w-1.5 h-1.5 rounded-full bg-[#22C55E]',
  body: 'p-5',
} as const;

/**
 * ConfigSection component for grouping related configuration values.
 */
export const ConfigSection: React.FC<ConfigSectionProps> = ({
  icon,
  iconVariant,
  title,
  badge,
  children,
  className,
}) => {
  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.header}>
        <div className={cn(styles.iconBox, ICON_BG_STYLES[iconVariant])}>
          {icon}
        </div>
        <span className={styles.title}>{title}</span>
        {badge && (
          <div className={BADGE_STYLES[badge.variant].container}>
            {badge.variant === 'online' && <div className={styles.onlineDot} />}
            <span className={BADGE_STYLES[badge.variant].text}>
              {badge.text}
            </span>
          </div>
        )}
      </div>

      <div className={styles.body}>{children}</div>
    </div>
  );
};
