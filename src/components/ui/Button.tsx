import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { buttonVariants, type ButtonVariants } from '../../styles/theme';
import { cn } from '../../utils';

/**
 * Button component props.
 * Extends HTML button attributes and CVA button variants.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  /**
   * If true, the button will render as a Slot (useful for composition with links).
   * @example
   * <Button asChild>
   *   <a href="/somewhere">Go somewhere</a>
   * </Button>
   */
  asChild?: boolean;
  /**
   * Optional icon to display before the button text.
   */
  icon?: React.ReactNode;
  /**
   * Shows a loading spinner and disables the button.
   */
  isLoading?: boolean;
}

/**
 * Styled button component with variants.
 *
 * Uses the semantic styles pattern - all Tailwind classes are defined in theme.ts
 * and composed here using the cn() utility.
 *
 * @example
 * // Primary button
 * <Button variant="primary" size="lg">Submit</Button>
 *
 * // Secondary with icon
 * <Button variant="secondary" icon="🚀">Launch</Button>
 *
 * // Full width loading state
 * <Button fullWidth isLoading>Processing...</Button>
 *
 * // As a link
 * <Button asChild variant="ghost">
 *   <a href="/docs">Documentation</a>
 * </Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      icon,
      isLoading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export default Button;
