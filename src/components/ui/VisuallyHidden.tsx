import React from 'react';

const styles = {
  /**
   * Styles that hide content visually while keeping it accessible to screen readers.
   * This follows the standard "sr-only" pattern used in accessibility.
   */
  visuallyHidden: [
    'absolute',
    'w-[1px] h-[1px]',
    'p-0 m-[-1px]',
    'overflow-hidden',
    'whitespace-nowrap',
    'border-0',
    '[clip:rect(0,0,0,0)]',
  ].join(' '),
} as const;

export interface VisuallyHiddenProps {
  /** Content to hide visually but keep accessible */
  children: React.ReactNode;
  /** Element type to render (default: span) */
  as?: 'span' | 'div';
}

/**
 * VisuallyHidden component
 *
 * Hides content visually while keeping it accessible to screen readers.
 * Useful for providing accessible labels to elements that have no visible text.
 *
 * @example
 * ```tsx
 * <Dialog>
 *   <DialogContent>
 *     <VisuallyHidden>
 *       <DialogTitle>Account Details</DialogTitle>
 *     </VisuallyHidden>
 *     {/* visible content *\/}
 *   </DialogContent>
 * </Dialog>
 * ```
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Element = 'span',
}) => {
  return <Element className={styles.visuallyHidden}>{children}</Element>;
};

VisuallyHidden.displayName = 'VisuallyHidden';
