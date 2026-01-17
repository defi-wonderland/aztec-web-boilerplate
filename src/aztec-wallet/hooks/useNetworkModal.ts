import { useCallback } from 'react';
import { useModalStore } from '../store/modal';

/**
 * Hook for controlling the network selection modal
 *
 * @example
 * ```tsx
 * const { isOpen, open, close } = useNetworkModal();
 *
 * return (
 *   <button onClick={open}>Select Network</button>
 * );
 * ```
 */
export function useNetworkModal() {
  const openModal = useModalStore((state) => state.openModal);
  const openNetworkModal = useModalStore((state) => state.openNetworkModal);
  const closeModal = useModalStore((state) => state.closeModal);

  const isOpen = openModal === 'network';

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openNetworkModal();
      } else {
        closeModal();
      }
    },
    [openNetworkModal, closeModal]
  );

  return {
    isOpen,
    open: openNetworkModal,
    close: closeModal,
    onOpenChange,
  };
}
