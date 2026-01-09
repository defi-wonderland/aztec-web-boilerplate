import { create } from 'zustand';
import { createBrowserActions } from './actions/browser';
import { createEmbeddedActions } from './actions/embedded';
import { createExternalSignerActions } from './actions/externalSigner';
import type { WalletStore, WalletState } from './types';

export type { WalletStore, PXEStatus } from './types';

const INITIAL_STATE: WalletState = {
  account: null,
  walletType: null,
  status: 'disconnected',
  error: null,
  pxeStatus: 'idle',
  pxeError: null,
  signerType: null,
  connectedRdns: null,
  caipAccount: null,
  caipAccounts: [],
  supportedChains: [],
  isInstalled: false,
};

export const useWalletStore = create<WalletStore>((set, get) => ({
  ...INITIAL_STATE,

  // Embedded actions
  ...createEmbeddedActions(set, get),

  // External Signer actions
  ...createExternalSignerActions(set, get),

  // Browser Wallet actions
  ...createBrowserActions(set, get),

  // Shared actions
  disconnect: () => {
    set({
      account: null,
      walletType: null,
      status: 'disconnected',
      error: null,
      signerType: null,
      connectedRdns: null,
      caipAccount: null,
      caipAccounts: [],
      supportedChains: [],
      isInstalled: false,
      pxeStatus: 'idle',
      pxeError: null,
    });
  },

  setError: (error) => set({ error }),

  setPXEStatus: (pxeStatus, pxeError = null) => set({ pxeStatus, pxeError }),

  reset: () => set(INITIAL_STATE),
}));

export const getWalletStore = () => useWalletStore.getState();
