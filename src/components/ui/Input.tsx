import React from 'react';
import { inputVariants, type InputVariants } from '../../styles/theme';
import { cn } from '../../utils';

/**
 * Input component props.
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    InputVariants {
  /**
   * Error message to display below the input.
   */
  error?: string;
  /**
   * Label for the input field.
   */
  label?: string;
  /**
   * Helper text displayed below the input.
   */
  helperText?: string;
}

/**
 * Styled input component with error states and labels.
 *
 * @example
 * <Input label="Email" placeholder="Enter email" />
 * <Input hasError error="Invalid email" />
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, error, label, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const showError = hasError || !!error;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-default"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          className={cn(inputVariants({ hasError: showError }), className)}
          ref={ref}
          aria-invalid={showError}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-500">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
