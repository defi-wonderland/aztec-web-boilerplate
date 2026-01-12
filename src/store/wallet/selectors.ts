import { useShallow } from 'zustand/react/shallow';
import { useWalletStore } from './store';

export const useWalletView = () =>
  useWalletStore(
    useShallow((state) => ({
      account: state.account,
      status: state.status,
      walletType: state.walletType,
      error: state.error,
      isPXEReady: state.pxeStatus === 'ready',
      pxeStatus: state.pxeStatus,
      activeConnectorId: state.activeConnectorId,
      connectingConnectorId: state.connectingConnectorId,
    }))
  );

export const useWalletConnectors = () =>
  useWalletStore((state) => state.connectors);

export const useWalletActions = () =>
  useWalletStore(
    useShallow((state) => ({
      setConnectors: state.setConnectors,
      connect: state.connect,
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
