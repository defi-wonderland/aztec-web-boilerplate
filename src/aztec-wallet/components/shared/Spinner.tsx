import React from 'react';
import { cn } from '../../../utils';

const styles = {
  spinner:
    'animate-spin rounded-full border-2 border-current border-t-transparent text-accent',
  sizes: {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  },
} as const;

export interface SpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional class names */
  className?: string;
}

/**
 * Loading spinner component
 */
export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
  return (
    <div
      className={cn(styles.spinner, styles.sizes[size], className)}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
