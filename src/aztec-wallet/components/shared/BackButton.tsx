import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn, iconSize } from '../../../utils';

const styles = {
  button: [
    'flex items-center gap-2',
    'text-muted hover:text-default',
    'transition-colors',
    'cursor-pointer',
    'text-sm',
  ].join(' '),
} as const;

export interface BackButtonProps {
  /** Click handler */
  onClick?: () => void;
  /** Button label (default: "back") */
  label?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Back navigation button
 */
export const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  label = 'back',
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(styles.button, className)}
    >
      <ArrowLeft size={iconSize()} />
      <span>{label}</span>
    </button>
  );
};
