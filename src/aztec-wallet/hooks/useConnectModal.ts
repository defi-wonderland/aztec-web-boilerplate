import { useCallback } from 'react';
import { useModalStore } from '../store/modal';

/**
 * Hook for controlling the connect modal
 *
 * @example
 * ```tsx
 * const { isOpen, open, close } = useConnectModal();
 *
 * return (
 *   <button onClick={open}>Connect</button>
 * );
 * ```
 */
export function useConnectModal() {
  const openModal = useModalStore((state) => state.openModal);
  const openConnectModal = useModalStore((state) => state.openConnectModal);
  const closeModal = useModalStore((state) => state.closeModal);

  const isOpen = openModal === 'connect';

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openConnectModal();
      } else {
        closeModal();
      }
    },
    [openConnectModal, closeModal]
  );

  return {
    isOpen,
    open: openConnectModal,
    close: closeModal,
    onOpenChange,
  };
}
