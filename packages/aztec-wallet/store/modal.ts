import { create } from 'zustand';

type ModalType = 'connect' | 'account' | 'network' | null;

interface ModalState {
  /** Currently open modal */
  openModal: ModalType;
  /** Open the connect modal */
  openConnectModal: () => void;
  /** Open the account modal */
  openAccountModal: () => void;
  /** Open the network modal */
  openNetworkModal: () => void;
  /** Close any open modal */
  closeModal: () => void;
  /** Set modal (for onOpenChange handlers) */
  setModal: (modal: ModalType) => void;
}

/**
 * Global modal state store
 *
 * Manages which modal is currently open. Only one modal can be open at a time.
 */
export const useModalStore = create<ModalState>((set) => ({
  openModal: null,

  openConnectModal: () => set({ openModal: 'connect' }),

  openAccountModal: () => set({ openModal: 'account' }),

  openNetworkModal: () => set({ openModal: 'network' }),

  closeModal: () => set({ openModal: null }),

  setModal: (modal) => set({ openModal: modal }),
}));

/**
 * Get modal store outside of React components
 */
export const getModalStore = () => useModalStore.getState();
