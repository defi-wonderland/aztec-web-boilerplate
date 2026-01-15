import React from 'react';
import { cardVariants, type CardVariants } from '../../styles/theme';
import { cn } from '../../utils';

/**
 * Card component props.
 */
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    CardVariants {}

/**
 * Card container component with consistent styling.
 *
 * @example
 * <Card>Content</Card>
 * <Card padding="lg" hover>Hoverable card</Card>
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, hover, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ padding, hover }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card header section.
 */
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 pb-4', className)}
    {...props}
  >
    {children}
  </div>
));

CardHeader.displayName = 'CardHeader';

/**
 * Card title element.
 */
export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold text-default', className)}
    {...props}
  >
    {children}
  </h3>
));

CardTitle.displayName = 'CardTitle';

/**
 * Card description element.
 */
export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted', className)} {...props}>
    {children}
  </p>
));

CardDescription.displayName = 'CardDescription';

/**
 * Card content section.
 */
export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props}>
    {children}
  </div>
));

CardContent.displayName = 'CardContent';

/**
 * Card footer section.
 */
export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center pt-4', className)} {...props}>
    {children}
  </div>
));

CardFooter.displayName = 'CardFooter';

export default Card;
