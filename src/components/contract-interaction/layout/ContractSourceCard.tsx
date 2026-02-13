import React from 'react';
import { cn, iconSize } from '../../../utils';
import type { LucideIcon } from 'lucide-react';

const styles = {
  card: cn(
    'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer',
    'bg-surface border transition-all duration-200',
    'hover:shadow-theme-hover'
  ),
  cardSelected: 'border-2 border-accent',
  cardUnselected: 'border-default',
  iconWrapper: cn(
    'flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0',
    'transition-colors duration-200'
  ),
  iconWrapperSelected: 'bg-accent',
  iconWrapperUnselected: 'bg-surface-tertiary',
  iconSelected: 'text-white',
  iconUnselected: 'text-muted',
  content: 'flex flex-col gap-0.5 text-left',
  title: 'text-sm font-semibold text-default',
  description: 'text-xs text-muted',
} as const;

interface ContractSourceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

export const ContractSourceCard: React.FC<ContractSourceCardProps> = ({
  icon: Icon,
  title,
  description,
  isSelected,
  onClick,
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        styles.card,
        isSelected ? styles.cardSelected : styles.cardUnselected,
        className
      )}
    >
      <div
        className={cn(
          styles.iconWrapper,
          isSelected ? styles.iconWrapperSelected : styles.iconWrapperUnselected
        )}
      >
        <Icon
          size={iconSize('md')}
          className={isSelected ? styles.iconSelected : styles.iconUnselected}
        />
      </div>
      <div className={styles.content}>
        <span className={styles.title}>{title}</span>
        <span className={styles.description}>{description}</span>
      </div>
    </button>
  );
};
