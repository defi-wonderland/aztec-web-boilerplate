/**
 * Verification Store
 *
 * Zustand store for coordinating the emoji verification step
 * between the DemoWalletAdapter and the ConnectModal.
 *
 * Flow:
 * 1. Adapter calls requestVerification(hash, name, icon?) — pauses on returned Promise
 * 2. Modal subscribes to store, navigates to emoji-verification view when hash appears
 * 3. User clicks "Emojis Match" → confirmVerification() → resolves promise with true
 * 4. User clicks "Cancel" → cancelVerification() → resolves promise with false
 */

import { createStore } from 'zustand/vanilla';

interface VerificationState {
  /** The verification hash from the ECDH key exchange */
  verificationHash: string | null;
  /** Display name of the wallet being verified */
  walletName: string | null;
  /** Icon URL of the wallet being verified */
  walletIcon: string | null;
  /** Whether a verification is currently pending */
  isPending: boolean;
}

interface VerificationActions {
  /**
   * Called by the adapter when a verification is needed.
   * Returns a Promise that resolves to true (confirmed) or false (cancelled).
   */
  requestVerification: (
    hash: string,
    name: string,
    icon?: string
  ) => Promise<boolean>;
  /** Called by the modal when user confirms emojis match */
  confirmVerification: () => void;
  /** Called by the modal when user cancels verification */
  cancelVerification: () => void;
  /** Reset verification state */
  reset: () => void;
}

type VerificationStore = VerificationState & VerificationActions;

const initialState: VerificationState = {
  verificationHash: null,
  walletName: null,
  walletIcon: null,
  isPending: false,
};

// Holds the resolve function for the pending verification promise
let pendingResolve: ((confirmed: boolean) => void) | null = null;

export const verificationStore = createStore<VerificationStore>((set) => ({
  ...initialState,

  requestVerification: (hash, name, icon) => {
    return new Promise<boolean>((resolve) => {
      // Store the resolver so confirm/cancel can call it
      pendingResolve = resolve;
      set({
        verificationHash: hash,
        walletName: name,
        walletIcon: icon ?? null,
        isPending: true,
      });
    });
  },

  confirmVerification: () => {
    if (pendingResolve) {
      pendingResolve(true);
      pendingResolve = null;
    }
    set(initialState);
  },

  cancelVerification: () => {
    if (pendingResolve) {
      pendingResolve(false);
      pendingResolve = null;
    }
    set(initialState);
  },

  reset: () => {
    if (pendingResolve) {
      pendingResolve(false);
      pendingResolve = null;
    }
    set(initialState);
  },
}));

/** Get the current verification store state */
export const getVerificationStore = () => verificationStore.getState();

/** Subscribe to verification store changes */
export const useVerificationStore = verificationStore;
