import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useModalStore } from '../store/modal';

/**
 * Hook for controlling the connect modal programmatically.
 *
 * Use this hook when building custom UI that needs to open/close
 * the connect modal. The modal itself is rendered by AztecWalletProvider.
 *
 * @returns Object containing:
 * - `isOpen` - Whether the connect modal is currently open
 * - `open` - Function to open the connect modal
 * - `close` - Function to close the connect modal
 * - `onOpenChange` - Callback for controlled open state (for Radix Dialog)
 *
 * @example Basic usage
 * ```tsx
 * const { open } = useConnectModal();
 *
 * return <button onClick={open}>Connect Wallet</button>;
 * ```
 *
 * @example Custom connect button
 * ```tsx
 * const { isConnected } = useAztecWallet();
 * const { open: openConnect } = useConnectModal();
 * const { open: openAccount } = useAccountModal();
 *
 * return (
 *   <button onClick={isConnected ? openAccount : openConnect}>
 *     {isConnected ? 'View Account' : 'Connect'}
 *   </button>
 * );
 * ```
 *
 * @example Controlled modal state (advanced)
 * ```tsx
 * const { isOpen, onOpenChange } = useConnectModal();
 *
 * // The onOpenChange callback handles both open and close
 * <Dialog open={isOpen} onOpenChange={onOpenChange}>
 *   ...
 * </Dialog>
 * ```
 */
export function useConnectModal() {
  const { openModal, openConnectModal, closeModal } = useModalStore(
    useShallow((state) => ({
      openModal: state.openModal,
      openConnectModal: state.openConnectModal,
      closeModal: state.closeModal,
    }))
  );

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
