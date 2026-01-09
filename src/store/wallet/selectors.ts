import { useShallow } from 'zustand/react/shallow';
import { useWalletStore } from './store';

/**
 * Core wallet state - account, status, type, error, and PXE readiness
 */
export const useWalletState = () =>
  useWalletStore(
    useShallow((state) => ({
      account: state.account,
      status: state.status,
      walletType: state.walletType,
      error: state.error,
      isPXEReady: state.pxeStatus === 'ready',
    }))
  );

/**
 * All wallet actions
 */
export const useWalletActions = () =>
  useWalletStore(
    useShallow((state) => ({
      connectEmbedded: state.connectEmbedded,
      connectExistingEmbedded: state.connectExistingEmbedded,
      hasSavedEmbeddedAccount: state.hasSavedEmbeddedAccount,
      connectExternalSigner: state.connectExternalSigner,
      connectBrowserWallet: state.connectBrowserWallet,
      setBrowserWalletState: state.setBrowserWalletState,
      disconnect: state.disconnect,
      setError: state.setError,
      setPXEStatus: state.setPXEStatus,
      reset: state.reset,
    }))
  );
