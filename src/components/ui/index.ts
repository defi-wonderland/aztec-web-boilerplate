/**
 * UI Component Library
 *
 * Exports all primitive UI components built with Tailwind CSS and Radix UI.
 * These components follow the semantic styling pattern with CVA variants.
 */

// Button
export { Button, type ButtonProps } from './Button';

// Form inputs
export { Input, type InputProps } from './Input';
export { Textarea, type TextareaProps } from './Textarea';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './Select';

// Display components
export { Badge, type BadgeProps } from './Badge';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from './Card';

// Theme toggle
export { ThemeToggle } from './ThemeToggle';

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

// Dialog / Modal
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  type DialogContentProps,
} from './Dialog';

// Toast notifications - primitives
export {
  ToastProvider as RadixToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  type ToastProps,
  type ToastVariants,
} from './Toast';

// Toaster - high-level toast component
export { Toaster } from './Toaster';

// Tooltip
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './Tooltip';

// Toggle
export { Toggle, toggleVariants, type ToggleProps } from './Toggle';

// Accessibility utilities
export { VisuallyHidden, type VisuallyHiddenProps } from './VisuallyHidden';
