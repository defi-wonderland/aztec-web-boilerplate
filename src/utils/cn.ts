import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and tailwind-merge.
 * This allows conditional classes and properly merges Tailwind utilities.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-blue-500', className)
 * cn('text-red-500', 'text-blue-500') // => 'text-blue-500' (merged)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
