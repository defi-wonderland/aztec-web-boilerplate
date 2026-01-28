import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useModalStore } from '../store/modal';

/**
 * Hook for controlling the account details modal programmatically.
 *
 * Use this hook when building custom UI that needs to open/close
 * the account modal. The modal shows the connected wallet address
 * and provides a disconnect button. The modal is rendered by AztecWalletProvider.
 *
 * @returns Object containing:
 * - `isOpen` - Whether the account modal is currently open
 * - `open` - Function to open the account modal
 * - `close` - Function to close the account modal
 * - `onOpenChange` - Callback for controlled open state (for Radix Dialog)
 *
 * @example Basic usage
 * ```tsx
 * const { open } = useAccountModal();
 *
 * return <button onClick={open}>View Account</button>;
 * ```
 *
 * @example Show account details for connected users
 * ```tsx
 * const { isConnected, address } = useAztecWallet();
 * const { open } = useAccountModal();
 *
 * if (!isConnected) return null;
 *
 * return (
 *   <button onClick={open}>
 *     {address?.slice(0, 6)}...{address?.slice(-4)}
 *   </button>
 * );
 * ```
 *
 * @example Custom connected state button
 * ```tsx
 * const { isConnected } = useAztecWallet();
 * const { open: openConnect } = useConnectModal();
 * const { open: openAccount } = useAccountModal();
 *
 * return (
 *   <button onClick={isConnected ? openAccount : openConnect}>
 *     {isConnected ? 'Account' : 'Connect'}
 *   </button>
 * );
 * ```
 */
export function useAccountModal() {
  const { openModal, openAccountModal, closeModal } = useModalStore(
    useShallow((state) => ({
      openModal: state.openModal,
      openAccountModal: state.openAccountModal,
      closeModal: state.closeModal,
    }))
  );

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
