import { useCallback } from 'react';
import { useModalStore } from '../store/modal';

/**
 * Hook for controlling the account details modal
 *
 * @example
 * ```tsx
 * const { isOpen, open, close } = useAccountModal();
 *
 * return (
 *   <button onClick={open}>Account</button>
 * );
 * ```
 */
export function useAccountModal() {
  const openModal = useModalStore((state) => state.openModal);
  const openAccountModal = useModalStore((state) => state.openAccountModal);
  const closeModal = useModalStore((state) => state.closeModal);

  const isOpen = openModal === 'account';

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openAccountModal();
      } else {
        closeModal();
      }
    },
    [openAccountModal, closeModal]
  );

  return {
    isOpen,
    open: openAccountModal,
    close: closeModal,
    onOpenChange,
  };
}
