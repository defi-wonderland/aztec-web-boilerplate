// useCopyToast: copy text to the clipboard and confirm with a toast.
//
// Thin convenience over `useToast()` — encapsulates the clipboard write, the
// insecure-context failure case, and the success toast, so callers just do:
//
//   const { copy } = useCopyToast();
//   copy(address.toString(), 'Address copied to clipboard');
//
// Toast lifecycle (open/dismiss/animation) is owned by <ToastProvider>.
import { useCallback } from 'react';
import { useToast } from './useToast';

export interface UseCopyToast {
  /** Copy `text`; toasts `message` on success. Returns false if the clipboard
   *  is unavailable (e.g. insecure context) — no toast in that case. */
  copy: (text: string, message?: string) => Promise<boolean>;
}

export function useCopyToast(): UseCopyToast {
  const { toast } = useToast();

  const copy = useCallback(
    async (text: string, message = 'Copied to clipboard'): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false; // clipboard unavailable (e.g. insecure context)
      }
      toast(message);
      return true;
    },
    [toast],
  );

  return { copy };
}
