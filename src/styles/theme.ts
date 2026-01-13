/**
 * =============================================================================
 * COMPONENT VARIANTS (CVA - Class Variance Authority)
 * =============================================================================
 *
 * This file defines reusable component variants using CVA.
 * All Tailwind classes are centralized here for a semantic styling pattern.
 *
 * Usage in components:
 *   import { buttonVariants } from '../styles/theme';
 *   <button className={cn(buttonVariants({ variant: 'primary', size: 'md' }), className)}>
 *
 * Custom theme utilities (bg-surface, text-accent, gradient-primary, etc.)
 * are defined in globals.css and use CSS variables for light/dark mode support.
 */

import { cva, type VariantProps } from 'class-variance-authority';

/* =============================================================================
   BUTTON VARIANTS
   ============================================================================= */

export const buttonVariants = cva(
  // Base styles - applied to all buttons
  [
    'inline-flex items-center justify-center gap-2',
    'font-semibold transition-all duration-200',
    'rounded-lg cursor-pointer',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      variant: {
        primary: [
          'gradient-primary text-on-accent',
          'shadow-theme hover:shadow-theme-hover',
          'hover:scale-[1.02] active:scale-[0.98]',
        ],
        secondary: [
          'bg-surface text-accent',
          'border border-accent/35',
          'hover:bg-surface-secondary hover:border-accent',
        ],
        ghost: ['bg-transparent text-default', 'hover:bg-surface-secondary'],
        danger: ['bg-red-500 text-white', 'hover:bg-red-600'],
        'danger-outline': [
          'bg-transparent text-red-500',
          'border border-red-500/50',
          'hover:bg-red-500/10 hover:border-red-500',
        ],
        // Icon button variants
        icon: [
          'bg-transparent text-muted',
          'hover:bg-surface-tertiary hover:text-default',
          'rounded-md',
        ],
        // Toggle button (square with border)
        toggle: [
          'bg-surface-secondary text-default',
          'border border-default',
          'hover:bg-accent/10 hover:border-accent/50',
        ],
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-6 py-4 text-base',
        icon: 'p-2',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/* =============================================================================
   INPUT VARIANTS
   ============================================================================= */

export const inputVariants = cva(
  [
    'w-full h-12 px-4 py-3',
    'bg-surface text-default',
    'border border-default rounded-lg',
    'transition-all duration-200',
    'placeholder:text-muted',
    'focus:outline-none focus:border-accent',
    'focus:ring-2 focus:ring-accent/20',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-tertiary',
  ],
  {
    variants: {
      hasError: {
        true: 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
      },
    },
  }
);

export type InputVariants = VariantProps<typeof inputVariants>;

/* =============================================================================
   CARD VARIANTS
   ============================================================================= */

export const cardVariants = cva(
  [
    'rounded-xl',
    'border border-default',
    'bg-surface-secondary',
    'shadow-theme',
  ],
  {
    variants: {
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
      hover: {
        true: 'transition-all duration-200 hover:shadow-theme-hover hover:-translate-y-0.5',
      },
    },
    defaultVariants: {
      padding: 'md',
    },
  }
);

export type CardVariants = VariantProps<typeof cardVariants>;

/* =============================================================================
   BADGE VARIANTS
   ============================================================================= */

export const badgeVariants = cva(
  [
    'inline-flex items-center',
    'px-2.5 py-0.5 rounded-full',
    'text-xs font-medium',
  ],
  {
    variants: {
      variant: {
        default: 'bg-surface-tertiary text-secondary',
        primary: 'bg-accent text-on-accent',
        success: 'bg-green-500/10 text-green-500',
        error: 'bg-red-500/10 text-red-500',
        warning: 'bg-amber-500/10 text-amber-500',
        info: 'bg-blue-500/10 text-blue-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

/* =============================================================================
   MODAL / DIALOG VARIANTS
   ============================================================================= */

export const dialogOverlayVariants = cva([
  'fixed inset-0 z-50',
  'bg-black/50 backdrop-blur-sm',
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
]);

export const dialogContentVariants = cva(
  [
    'fixed left-1/2 top-1/2 z-50',
    '-translate-x-1/2 -translate-y-1/2',
    'w-full max-w-lg',
    'bg-surface border border-default rounded-xl',
    'shadow-theme-lg',
    'p-6',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
    'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
  ],
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export type DialogContentVariants = VariantProps<typeof dialogContentVariants>;

/* =============================================================================
   NAVBAR VARIANTS (for future migration)
   ============================================================================= */

export const navbarVariants = cva([
  'sticky top-0 z-40',
  'w-full',
  'backdrop-navbar',
  'border-b border-default',
]);

/* =============================================================================
   STATUS INDICATOR VARIANTS
   ============================================================================= */

export const statusDotVariants = cva(['w-2 h-2 rounded-full'], {
  variants: {
    status: {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-amber-500',
      info: 'bg-blue-500',
      idle: 'bg-gray-400',
    },
    pulse: {
      true: 'animate-pulse',
    },
  },
  defaultVariants: {
    status: 'idle',
  },
});

export type StatusDotVariants = VariantProps<typeof statusDotVariants>;
