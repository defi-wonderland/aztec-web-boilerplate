import React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../../utils';

/**
 * Toast provider component.
 */
export const ToastProvider = ToastPrimitive.Provider;

/**
 * Toast viewport - where toasts appear.
 * Positioned at bottom-right on desktop, bottom on mobile.
 * Toasts stack with gap and animate smoothly.
 */
export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed z-100 flex max-h-screen w-full flex-col gap-2 p-4',
      'bottom-0 right-0',
      'sm:max-w-md',
      className
    )}
    {...props}
  />
));

ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

/**
 * Toast variants.
 * Enter/exit animations handled via CSS in globals.css.
 * Swipe gestures handled via Tailwind data attributes below.
 */
export const toastVariants = cva(
  [
    'group pointer-events-auto relative flex w-full items-center justify-between',
    'gap-4 overflow-hidden rounded-xl border p-4 pr-10 shadow-theme-lg',
    'backdrop-blur-sm',
    // Swipe gesture handling
    'data-[swipe=cancel]:translate-x-0',
    'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    'data-[swipe=move]:transition-none',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
  ],
  {
    variants: {
      variant: {
        default: 'border-default bg-surface/95 text-default',
        success:
          'border-green-500/50 bg-green-500/10 text-green-800 dark:text-green-400',
        error: 'border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-400',
        warning:
          'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-400',
        info: 'border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-400',
        loading: 'border-default bg-surface/95 text-default',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type ToastVariants = VariantProps<typeof toastVariants>;

/**
 * Toast component props.
 */
export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    ToastVariants {}

/**
 * Toast component.
 */
export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn('ToastRoot', toastVariants({ variant }), className)}
      {...props}
    />
  );
});

Toast.displayName = ToastPrimitive.Root.displayName;

/**
 * Toast action button.
 */
export const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center cursor-pointer',
      'rounded-md border border-current/30 bg-transparent px-3',
      'text-sm font-medium',
      'transition-transform duration-150 hover:scale-105 active:scale-95',
      'focus:outline-none focus:ring-2 focus:ring-accent/20',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));

ToastAction.displayName = ToastPrimitive.Action.displayName;

/**
 * Toast close button.
 */
export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, children, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      'absolute right-3 top-3 rounded-md p-1 cursor-pointer',
      'text-current opacity-50 transition-all duration-200',
      'hover:opacity-100 hover:scale-110',
      'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent/20',
      className
    )}
    toast-close=""
    {...props}
  >
    {children ?? <X className="h-4 w-4" />}
  </ToastPrimitive.Close>
));

ToastClose.displayName = ToastPrimitive.Close.displayName;

/**
 * Toast title.
 */
export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
));

ToastTitle.displayName = ToastPrimitive.Title.displayName;

/**
 * Toast description.
 */
export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
));

ToastDescription.displayName = ToastPrimitive.Description.displayName;
