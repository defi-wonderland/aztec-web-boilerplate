// ToastProvider: app-level toast root + imperative API.
//
// Mount this once near the app root (via AppProviders). It renders the single
// Radix `Toast.Provider`/`Toast.Viewport` and keeps a queue of active toasts, so
// any component can raise one via `useToast()` (see ../hooks/useToast):
//
//   const { toast } = useToast();
//   toast('Saved');                       // shorthand
//   toast({ title: 'Saved', duration: 4000 });
//
// Each call pushes a fresh entry with its own key, so repeated toasts always
// re-animate (no close-then-reopen dance needed). A closed toast is removed
// after its exit animation so the list doesn't grow unbounded.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { Check } from 'lucide-react';
import { ToastContext, type ToastOptions } from '../hooks/useToast';

interface ToastItem extends ToastOptions {
  id: number;
  open: boolean;
}

// Matches the exit keyframe (wb-toast-out, 150ms) in index.css, with a margin.
const EXIT_MS = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((opts: ToastOptions | string) => {
    const next = typeof opts === 'string' ? { title: opts } : opts;
    const id = (idRef.current += 1);
    setItems((prev) => [...prev, { ...next, id, open: true }]);
  }, []);

  const handleOpenChange = useCallback((id: number, open: boolean) => {
    if (open) return;
    // Mark closed so Radix plays the exit animation, then drop it from the list.
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right" duration={2200}>
        {children}
        {items.map((t) => (
          <Toast.Root
            key={t.id}
            className={styles.toast}
            open={t.open}
            duration={t.duration}
            onOpenChange={(open) => handleOpenChange(t.id, open)}
          >
            <span className={styles.icon} aria-hidden>
              <Check className={styles.iconGlyph} />
            </span>
            <Toast.Title className={styles.title}>{t.title}</Toast.Title>
          </Toast.Root>
        ))}
        <Toast.Viewport className={styles.viewport} />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

const styles = {
  viewport:
    'fixed bottom-0 right-0 z-50 m-0 flex w-[360px] max-w-[100vw] list-none flex-col gap-2 p-6 outline-none',
  toast:
    'flex items-center gap-2.5 rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-ink shadow-[0_12px_32px_-8px_#000000cc] data-[state=open]:animate-[wb-toast-in_180ms_ease-out] data-[state=closed]:animate-[wb-toast-out_150ms_ease-in]',
  icon: 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-[0.7rem] text-success',
  iconGlyph: 'h-3 w-3',
  title: 'm-0 font-medium',
} as const;
