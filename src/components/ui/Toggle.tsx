import React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils';

const toggleVariants = cva(
  [
    'inline-flex items-center justify-center',
    'rounded-lg font-medium',
    'transition-all duration-200',
    'cursor-pointer',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-surface-secondary text-default',
          'border border-default',
          'hover:bg-accent/10 hover:border-accent/50',
          'data-[state=on]:bg-accent/15 data-[state=on]:border-accent/50 data-[state=on]:text-accent',
        ],
        ghost: [
          'bg-transparent text-muted',
          'hover:bg-surface-secondary hover:text-default',
          'data-[state=on]:bg-surface-secondary data-[state=on]:text-accent',
        ],
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-9 w-9',
        lg: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {}

const Toggle = React.forwardRef<
  React.ComponentRef<typeof TogglePrimitive.Root>,
  ToggleProps
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
