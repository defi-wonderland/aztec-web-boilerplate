import { useShallow } from 'zustand/react/shallow';
import { useWalletStore } from './store';

export const useWalletView = () =>
  useWalletStore(
    useShallow((state) => ({
      account: state.account,
      status: state.status,
      walletType: state.walletType,
      error: state.error,
      networkStatus: state.networkStatus,
      networkError: state.networkError,
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
      setNetworkStatus: state.setNetworkStatus,
      setPXEStatus: state.setPXEStatus,
      checkNetwork: state.checkNetwork,
      reset: state.reset,
    }))
  );
