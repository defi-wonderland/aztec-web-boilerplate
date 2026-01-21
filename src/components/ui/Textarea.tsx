import React from 'react';
import { inputVariants, type InputVariants } from '../../styles/theme';
import { cn } from '../../utils';

/**
 * Textarea component props.
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    InputVariants {
  /**
   * Error message to display below the textarea.
   */
  error?: string;
  /**
   * Label for the textarea field.
   */
  label?: string;
  /**
   * Helper text displayed below the textarea.
   */
  helperText?: string;
}

/**
 * Styled textarea component with error states and labels.
 *
 * @example
 * <Textarea label="Description" rows={4} />
 * <Textarea hasError error="Required field" />
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, error, label, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const showError = hasError || !!error;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-default"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            inputVariants({ hasError: showError }),
            'min-h-20 resize-y',
            className
          )}
          ref={ref}
          aria-invalid={showError}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="text-sm text-red-500">
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

Textarea.displayName = 'Textarea';

export default Textarea;
