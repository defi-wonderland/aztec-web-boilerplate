import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../utils';

/**
 * Tabs root component.
 */
export const Tabs = TabsPrimitive.Root;

/**
 * Tabs list container for triggers.
 */
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex w-full items-center',
      'rounded-lg bg-surface-secondary p-1.5',
      'border border-default',
      'gap-1',
      className
    )}
    {...props}
  />
));

TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * Tab trigger button.
 */
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex-1 inline-flex items-center justify-center gap-2',
      'whitespace-nowrap rounded-md px-4 py-2.5',
      'text-sm font-medium text-muted',
      'transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/20',
      'disabled:pointer-events-none disabled:opacity-50',
      // Hover state - using native Tailwind colors
      'hover:text-default hover:bg-surface-tertiary',
      // Active state - more prominent
      'data-[state=active]:bg-surface-tertiary data-[state=active]:text-accent',
      'data-[state=active]:shadow-sm',
      'cursor-pointer',
      className
    )}
    {...props}
  />
));

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * Tab content panel.
 */
export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20',
      'data-[state=inactive]:hidden',
      className
    )}
    {...props}
  />
));

TabsContent.displayName = TabsPrimitive.Content.displayName;
