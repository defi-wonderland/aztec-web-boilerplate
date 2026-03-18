import { create } from 'zustand';

import type { ModalView } from '../types';

type ModalType = 'connect' | 'account' | 'network' | null;

interface ModalState {
  /** Currently open modal */
  openModal: ModalType;
  /** Initial view for the connect modal (consumed once on open) */
  connectInitialView: ModalView | null;
  /** Open the connect modal */
  openConnectModal: (initialView?: ModalView) => void;
  /** Open the account modal */
  openAccountModal: () => void;
  /** Open the network modal */
  openNetworkModal: () => void;
  /** Close any open modal */
  closeModal: () => void;
  /** Set modal (for onOpenChange handlers) */
  setModal: (modal: ModalType) => void;
  /** Consume the initial view (returns it and clears it) */
  consumeConnectInitialView: () => ModalView | null;
}

/**
 * Global modal state store
 *
 * Manages which modal is currently open. Only one modal can be open at a time.
 */
export const useModalStore = create<ModalState>((set, get) => ({
  openModal: null,
  connectInitialView: null,

  openConnectModal: (initialView?: ModalView) =>
    set({ openModal: 'connect', connectInitialView: initialView ?? null }),

  openAccountModal: () => set({ openModal: 'account' }),

  openNetworkModal: () => set({ openModal: 'network' }),

  closeModal: () => set({ openModal: null, connectInitialView: null }),

  setModal: (modal) => set({ openModal: modal }),

  consumeConnectInitialView: () => {
    const view = get().connectInitialView;
    if (view) set({ connectInitialView: null });
    return view;
  },
}));

/**
 * Get modal store outside of React components
 */
export const getModalStore = () => useModalStore.getState();
