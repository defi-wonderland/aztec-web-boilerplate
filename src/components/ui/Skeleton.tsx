import React from 'react';
import { cn } from '../../utils';

const styles = {
  base: 'rounded-md',
} as const;

const skeletonStyle = {
  backgroundColor: 'var(--text-muted)',
  opacity: 0.15,
} as const;

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  style,
  ...props
}) => (
  <div
    className={cn(styles.base, className)}
    style={{ ...skeletonStyle, ...style }}
    {...props}
  />
);
