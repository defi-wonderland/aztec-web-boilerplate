import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  dialogOverlayVariants,
  dialogContentVariants,
  type DialogContentVariants,
} from '../../styles/theme';
import { cn } from '../../utils';

/**
 * Dialog root component.
 */
export const Dialog = DialogPrimitive.Root;

/**
 * Dialog trigger button.
 */
export const DialogTrigger = DialogPrimitive.Trigger;

/**
 * Dialog portal for rendering outside the DOM hierarchy.
 */
export const DialogPortal = DialogPrimitive.Portal;

/**
 * Dialog close button.
 */
export const DialogClose = DialogPrimitive.Close;

/**
 * Dialog overlay (backdrop).
 */
export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(dialogOverlayVariants(), className)}
    {...props}
  />
));

DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Dialog content props.
 */
export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    DialogContentVariants {
  /**
   * Whether to show the close button.
   * @default true
   */
  showCloseButton?: boolean;
}

/**
 * Dialog content container.
 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4',
            'rounded-sm opacity-70',
            'transition-opacity hover:opacity-100',
            'focus:outline-none focus:ring-2 focus:ring-accent/20',
            'text-muted hover:text-default',
            'cursor-pointer'
          )}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));

DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * Dialog header section.
 */
export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-1.5 text-center sm:text-left', className)}
    {...props}
  />
);

DialogHeader.displayName = 'DialogHeader';

/**
 * Dialog footer section.
 */
export const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4',
      className
    )}
    {...props}
  />
);

DialogFooter.displayName = 'DialogFooter';

/**
 * Dialog title.
 */
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-default', className)}
    {...props}
  />
));

DialogTitle.displayName = DialogPrimitive.Title.displayName;

/**
 * Dialog description.
 */
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted', className)}
    {...props}
  />
));

DialogDescription.displayName = DialogPrimitive.Description.displayName;
