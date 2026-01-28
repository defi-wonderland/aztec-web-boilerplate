import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useModalStore } from '../store/modal';

/**
 * Hook for controlling the network selection modal programmatically.
 *
 * Use this hook when building custom UI that needs to open/close
 * the network modal. The modal shows available networks and allows
 * users to switch between them. The modal is rendered by AztecWalletProvider.
 *
 * Note: Switching networks will disconnect the current wallet and
 * require reconnection.
 *
 * @returns Object containing:
 * - `isOpen` - Whether the network modal is currently open
 * - `open` - Function to open the network modal
 * - `close` - Function to close the network modal
 * - `onOpenChange` - Callback for controlled open state (for Radix Dialog)
 *
 * @example Basic usage
 * ```tsx
 * const { open } = useNetworkModal();
 *
 * return <button onClick={open}>Switch Network</button>;
 * ```
 *
 * @example Custom network picker button
 * ```tsx
 * const { networkName } = useAztecWallet();
 * const { open } = useNetworkModal();
 *
 * return (
 *   <button onClick={open}>
 *     Network: {networkName}
 *   </button>
 * );
 * ```
 *
 * @example Programmatic network switching (without modal)
 * ```tsx
 * // If you want to switch networks programmatically without
 * // showing the modal, use switchNetwork from useAztecWallet:
 * const { switchNetwork } = useAztecWallet();
 *
 * await switchNetwork('sandbox');
 * ```
 */
export function useNetworkModal() {
  const { openModal, openNetworkModal, closeModal } = useModalStore(
    useShallow((state) => ({
      openModal: state.openModal,
      openNetworkModal: state.openNetworkModal,
      closeModal: state.closeModal,
    }))
  );

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
